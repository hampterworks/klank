//! In-app git engine backed by libgit2 (`git2`).
//!
//! Replaces the desktop-only shell `git` so sync works on Android too, where no
//! `git` binary exists. HTTPS authentication uses a Personal Access Token stored
//! in the app-private config dir when set (required on Android), otherwise the
//! system credential helper (desktop). The token is never logged and never
//! written into remote URLs.
//!
//! Tauri-free: every function here takes an explicit `config_dir: &Path` (where
//! the tauri crate passes `app.path().app_config_dir()`) rather than an
//! `AppHandle`, so both the desktop app and the headless `klank-server` binary
//! drive the exact same engine. The tauri crate wraps each of these in a
//! `#[tauri::command(async)]` — the `(async)` matters there because the bodies
//! block on libgit2 network I/O and the `SYNC_LOCK` mutex, which would freeze
//! the UI thread; running them off-thread keeps the app responsive.

#[cfg(target_os = "android")]
use git2::CertificateCheckStatus;
use git2::{
    build::CheckoutBuilder, BranchType, Commit, Cred, CredentialType, Error, ErrorCode,
    FetchOptions, Index, IndexConflict, Oid, PushOptions, RemoteCallbacks, Repository, Signature,
    StatusOptions, Tree,
};
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};

#[derive(Serialize)]
pub struct GitChangedFile {
    pub status: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct GitResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

impl GitResult {
    fn ok(output: impl Into<String>) -> Self {
        Self {
            success: true,
            output: output.into(),
            error: None,
        }
    }
    fn err(e: Error) -> Self {
        Self {
            success: false,
            output: String::new(),
            error: Some(e.message().to_string()),
        }
    }
}

const TOKEN_FILE: &str = "git_token";

fn token_path(config_dir: &Path) -> PathBuf {
    config_dir.join(TOKEN_FILE)
}

fn read_token(config_dir: &Path) -> Option<String> {
    let t = std::fs::read_to_string(token_path(config_dir))
        .ok()?
        .trim()
        .to_string();
    if t.is_empty() {
        None
    } else {
        Some(t)
    }
}

/// Marker file recording that the user opted into the OS git credential helper
/// (desktop). It carries no secret — `callbacks()` already resolves the helper —
/// it just tells the app that auth is configured so sync stops asking for a PAT.
const CRED_MODE_FILE: &str = "git_cred_mode";

fn cred_mode_path(config_dir: &Path) -> PathBuf {
    config_dir.join(CRED_MODE_FILE)
}

fn system_credentials_enabled(config_dir: &Path) -> bool {
    cred_mode_path(config_dir).exists()
}

fn set_system_credentials(config_dir: &Path, enabled: bool) -> Result<(), String> {
    let path = cred_mode_path(config_dir);
    if !enabled {
        let _ = std::fs::remove_file(&path);
        return Ok(());
    }
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, "system").map_err(|e| e.to_string())?;
    Ok(())
}

/// Disables libgit2's repository-ownership validation. The server container
/// runs as a non-root user while `/data` is a bind mount owned by the host,
/// so the check would reject every repo. Single-user trusted container only —
/// desktop never calls this.
pub fn allow_foreign_repo_ownership() {
    // SAFETY: sets a process-global libgit2 flag; called once at startup
    // before any repository is opened.
    unsafe {
        let _ = git2::opts::set_verify_owner_validation(false);
    }
}

/// Stores (or, when empty, clears) the HTTPS Personal Access Token used for
/// push/pull/clone. Written app-private with `0600` perms on unix.
pub fn git_set_token(config_dir: &Path, token: String) -> Result<(), String> {
    let path = token_path(config_dir);
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let token = token.trim();
    if token.is_empty() {
        let _ = std::fs::remove_file(&path);
        return Ok(());
    }
    std::fs::write(&path, token).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

/// Whether a PAT is currently stored (so the UI can show its state without
/// exposing the token).
pub fn git_has_token(config_dir: &Path) -> bool {
    read_token(config_dir).is_some()
}

/// Whether sync has any usable authentication: a stored PAT, or the user has opted
/// into the OS credential helper. The frontend gates sync on this (not on the PAT
/// alone) so a configured helper works with no token.
pub fn git_is_authenticated(config_dir: &Path) -> bool {
    read_token(config_dir).is_some() || system_credentials_enabled(config_dir)
}

/// Whether the user has opted into the OS credential helper.
pub fn git_system_credentials_enabled(config_dir: &Path) -> bool {
    system_credentials_enabled(config_dir)
}

/// Desktop one-click sign-in: verifies the OS git credential helper can authenticate
/// against the repo's `origin` (this is what triggers Git Credential Manager's
/// interactive login on first use), and on success records that auth is configured.
pub fn git_use_system_credentials(config_dir: &Path, dir: &str) -> GitResult {
    match probe_system_credentials(dir) {
        Ok(()) => match set_system_credentials(config_dir, true) {
            Ok(()) => GitResult::ok("Using system Git credentials"),
            Err(e) => GitResult {
                success: false,
                output: String::new(),
                error: Some(e),
            },
        },
        Err(e) => GitResult::err(e),
    }
}

/// Turns off the system-credential opt-in (does not touch any stored PAT).
pub fn git_disable_system_credentials(config_dir: &Path) -> Result<(), String> {
    set_system_credentials(config_dir, false)
}

fn probe_system_credentials(dir: &str) -> Result<(), Error> {
    let repo = Repository::discover(dir)?;
    let mut remote = repo.find_remote("origin")?;
    if let Some(url) = remote.url() {
        if !url.starts_with("http://") && !url.starts_with("https://") {
            return Err(Error::from_str(
                "origin is not an HTTPS remote — the credential helper only applies to HTTPS",
            ));
        }
    }
    // Auth-only handshake using the helper exclusively (no stored PAT).
    remote
        .connect_auth(git2::Direction::Fetch, Some(callbacks_system_only()), None)
        .map_err(|_| {
            Error::from_str(
                "no system Git credentials found — configure a credential helper (e.g. Git Credential Manager) or set a token under Advanced",
            )
        })?;
    let _ = remote.disconnect();
    Ok(())
}

/// Resolves credentials through the user's configured git credential helper
/// (GCM, osxkeychain, …) via `git credential fill`.
///
/// We shell out ourselves rather than use git2's `Cred::credential_helper`
/// because git2 spawns the helper subprocess with a visible console on Windows,
/// which flashes a terminal window on every sync. Spawning it here lets us pass
/// `CREATE_NO_WINDOW` so it stays invisible. `GIT_TERMINAL_PROMPT=0` keeps git
/// from blocking on an interactive prompt when no helper is configured — it just
/// exits non-zero and we fall through, exactly like the old code path. `git` is
/// always present on desktop (the system-credential opt-in presupposes a
/// configured git helper); on Android the spawn fails and we fall through.
fn helper_credentials(url: &str, username: Option<&str>) -> Result<Cred, Error> {
    use std::io::Write;
    use std::process::{Command, Stdio};

    let mut cmd = Command::new("git");
    cmd.args(["credential", "fill"])
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| Error::from_str(&e.to_string()))?;
    // `git credential fill` parses a `url=` line into protocol/host/path itself.
    let mut input = format!("url={url}\n");
    if let Some(u) = username.filter(|u| !u.is_empty()) {
        input.push_str(&format!("username={u}\n"));
    }
    input.push('\n');
    child
        .stdin
        .take()
        .ok_or_else(|| Error::from_str("could not open git credential stdin"))?
        .write_all(input.as_bytes())
        .map_err(|e| Error::from_str(&e.to_string()))?;
    let out = child
        .wait_with_output()
        .map_err(|e| Error::from_str(&e.to_string()))?;
    if !out.status.success() {
        return Err(Error::from_str(
            "git credential helper returned no credentials",
        ));
    }

    let text = String::from_utf8_lossy(&out.stdout);
    let mut user = None;
    let mut pass = None;
    for line in text.lines() {
        if let Some(v) = line.strip_prefix("username=") {
            user = Some(v.to_string());
        } else if let Some(v) = line.strip_prefix("password=") {
            pass = Some(v.to_string());
        }
    }
    match (user, pass) {
        (Some(u), Some(p)) => Cred::userpass_plaintext(&u, &p),
        _ => Err(Error::from_str(
            "git credential helper did not return a username/password",
        )),
    }
}

/// Builds credential callbacks: PAT first (Android + as an override), then the
/// system credential helper (desktop). Owns a `PathBuf` (not a borrow) because
/// the returned callbacks are `'static` and read the token lazily at fetch time.
fn callbacks(config_dir: PathBuf) -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    let mut used_token = false;
    cb.credentials(move |url, username, allowed| {
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if !used_token {
                if let Some(token) = read_token(&config_dir) {
                    used_token = true;
                    // GitHub & friends accept the PAT as the password with any user.
                    return Cred::userpass_plaintext(username.unwrap_or("git"), &token);
                }
            }
            if let Ok(cred) = helper_credentials(url, username) {
                return Ok(cred);
            }
        }
        if allowed.contains(CredentialType::DEFAULT) {
            return Cred::default();
        }
        Err(Error::from_str(
            "no usable git credentials — set a token in Settings",
        ))
    });
    #[cfg(target_os = "android")]
    add_android_cert_check(&mut cb);
    cb
}

/// The vendored OpenSSL Android build is compiled with `no-stdio` (upstream
/// `openssl-src`), which disables `BIO_new_file` — so no CA file/dir can ever be
/// loaded, and libgit2's own `SSL_get_verify_result` check always reports the
/// cert as invalid, regardless of content. Delegate to reqwest's rustls +
/// webpki-roots stack instead, which does full chain + hostname validation with
/// no file I/O. Desktop keeps libgit2's normal OS-trust-store check untouched.
///
/// Runs on one of Tauri's tokio worker threads, where plain `block_on` panics
/// ("cannot start a runtime from within a runtime") and `reqwest::blocking`
/// panics on drop for the same reason. `block_in_place` is the documented way
/// to synchronously drive an async call from a worker thread: it hands this
/// thread's other queued tasks to another worker for the duration of the call.
#[cfg(target_os = "android")]
fn add_android_cert_check(cb: &mut RemoteCallbacks<'_>) {
    cb.certificate_check(|_cert, host| {
        let url = format!("https://{host}/");
        let result = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current()
                .block_on(async { reqwest::Client::new().head(&url).send().await })
        });
        match result {
            Ok(_) => Ok(CertificateCheckStatus::CertificateOk),
            Err(e) => Err(Error::from_str(&format!(
                "TLS certificate validation failed for {host}: {e}"
            ))),
        }
    });
}

/// Credential callbacks that use ONLY the OS credential helper (no stored PAT), so
/// the "Use system Git credentials" probe genuinely tests the helper.
fn callbacks_system_only() -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |url, username, allowed| {
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(cred) = helper_credentials(url, username) {
                return Ok(cred);
            }
        }
        if allowed.contains(CredentialType::DEFAULT) {
            return Cred::default();
        }
        Err(Error::from_str("no system git credentials"))
    });
    #[cfg(target_os = "android")]
    add_android_cert_check(&mut cb);
    cb
}

pub fn git_is_repo(dir: &str) -> bool {
    Repository::discover(dir).is_ok()
}

pub fn git_status(dir: &str) -> Result<Vec<GitChangedFile>, String> {
    let repo = Repository::discover(dir).map_err(|e| e.message().to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| e.message().to_string())?;
    Ok(statuses
        .iter()
        .filter_map(|entry| {
            entry.path().map(|p| GitChangedFile {
                status: status_code(entry.status()),
                path: p.to_string(),
            })
        })
        .collect())
}

fn status_code(s: git2::Status) -> String {
    if s.is_wt_new() || s.is_index_new() {
        "A".into()
    } else if s.is_wt_deleted() || s.is_index_deleted() {
        "D".into()
    } else if s.is_wt_renamed() || s.is_index_renamed() {
        "R".into()
    } else if s.is_wt_modified() || s.is_index_modified() {
        "M".into()
    } else {
        "?".into()
    }
}

pub fn git_commit(dir: &str, message: &str) -> GitResult {
    match commit_inner(dir, message) {
        Ok(()) => GitResult::ok("committed"),
        Err(e) => GitResult::err(e),
    }
}

fn commit_inner(dir: &str, message: &str) -> Result<(), Error> {
    let repo = Repository::discover(dir)?;
    ensure_git_excludes(&repo)?;
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;
    let tree = repo.find_tree(index.write_tree()?)?;
    let sig = signature(&repo)?;
    let parent = repo
        .head()
        .ok()
        .and_then(|h| h.target())
        .and_then(|oid| repo.find_commit(oid).ok());
    let parents: Vec<&git2::Commit> = parent.iter().collect();
    repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;
    Ok(())
}

fn signature(repo: &Repository) -> Result<Signature<'static>, Error> {
    let cfg = repo.config()?;
    let name = cfg
        .get_string("user.name")
        .unwrap_or_else(|_| "klank".into());
    let email = cfg
        .get_string("user.email")
        .unwrap_or_else(|_| "klank@localhost".into());
    Signature::now(&name, &email)
}

pub fn git_pull(config_dir: &Path, dir: &str) -> GitResult {
    match pull_inner(config_dir, dir) {
        Ok(msg) => GitResult::ok(msg),
        Err(e) => GitResult::err(e),
    }
}

fn pull_inner(config_dir: &Path, dir: &str) -> Result<String, Error> {
    let repo = Repository::discover(dir)?;
    let head = repo.head()?;
    let branch = head
        .shorthand()
        .ok_or_else(|| Error::from_str("no current branch"))?
        .to_string();

    let mut remote = repo.find_remote("origin")?;
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(config_dir.to_path_buf()));
    remote.fetch(&[&branch], Some(&mut fo), None)?;

    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;
    let (analysis, _) = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.is_up_to_date() {
        return Ok("Already up to date".into());
    }
    if analysis.is_fast_forward() {
        let refname = format!("refs/heads/{branch}");
        let mut reference = repo.find_reference(&refname)?;
        reference.set_target(fetch_commit.id(), "pull: fast-forward")?;
        repo.set_head(&refname)?;
        repo.checkout_head(Some(CheckoutBuilder::default().force()))?;
        return Ok("Fast-forwarded".into());
    }
    Err(Error::from_str(
        "local and remote have diverged — resolve the conflict on a desktop",
    ))
}

pub fn git_push(config_dir: &Path, dir: &str) -> GitResult {
    match push_inner(config_dir, dir) {
        Ok(msg) => GitResult::ok(msg),
        Err(e) => GitResult::err(e),
    }
}

fn push_inner(config_dir: &Path, dir: &str) -> Result<String, Error> {
    let repo = Repository::discover(dir)?;
    let head = repo.head()?;
    let branch = head
        .shorthand()
        .ok_or_else(|| Error::from_str("no current branch"))?
        .to_string();
    let mut remote = repo.find_remote("origin")?;
    let mut po = PushOptions::new();
    po.remote_callbacks(callbacks(config_dir.to_path_buf()));
    remote.push(
        &[format!("refs/heads/{branch}:refs/heads/{branch}")],
        Some(&mut po),
    )?;
    Ok(format!("Pushed {branch}"))
}

pub fn git_unpushed(dir: &str) -> Result<Vec<String>, String> {
    unpushed_inner(dir).map_err(|e| e.message().to_string())
}

fn unpushed_inner(dir: &str) -> Result<Vec<String>, Error> {
    let repo = Repository::discover(dir)?;
    let head = repo.head()?;
    let Some(local) = head.target() else {
        return Ok(vec![]);
    };
    let branch = head
        .shorthand()
        .ok_or_else(|| Error::from_str("no current branch"))?;
    let upstream = match repo.find_reference(&format!("refs/remotes/origin/{branch}")) {
        Ok(r) => r.target(),
        Err(_) => return Ok(vec![]), // no upstream tracked yet
    };
    let Some(upstream) = upstream else {
        return Ok(vec![]);
    };

    let mut revwalk = repo.revwalk()?;
    revwalk.push(local)?;
    revwalk.hide(upstream)?;
    let mut out = Vec::new();
    for oid in revwalk {
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        out.push(format!(
            "{} {}",
            &oid.to_string()[..7],
            commit.summary().unwrap_or("")
        ));
    }
    Ok(out)
}

pub fn git_clone(config_dir: &Path, url: &str, dir: &str) -> GitResult {
    match clone_inner(config_dir, url, dir) {
        Ok(()) => GitResult::ok("Cloned"),
        Err(e) => GitResult::err(e),
    }
}

/// Clones by init + fetch + checkout rather than `RepoBuilder::clone`, which
/// refuses any non-empty target directory. On Android the tab directory *is*
/// the app's config dir (see `token_path`), so it already holds `git_token`
/// and `.klank-settings.json` by the time a user clicks Clone — a plain
/// libgit2 clone fails there every time with "exists and is not an empty
/// directory". `checkout_head` only writes paths present in the remote tree,
/// so pre-existing unrelated files (config, WebView cache dirs) are left alone.
fn clone_inner(config_dir: &Path, url: &str, dir: &str) -> Result<(), Error> {
    let path = Path::new(dir);
    std::fs::create_dir_all(path).map_err(|e| Error::from_str(&e.to_string()))?;

    let repo = Repository::init(path)?;
    ensure_git_excludes(&repo)?;
    // A prior failed clone attempt (e.g. a network/auth error) can leave `origin`
    // already configured; reuse and repoint it instead of erroring on retry.
    let mut remote = match repo.find_remote("origin") {
        Ok(_) => {
            repo.remote_set_url("origin", url)?;
            repo.find_remote("origin")?
        }
        Err(_) => repo.remote("origin", url)?,
    };

    // The default branch is only known after connecting to the remote, but
    // remains readable after disconnecting — so scope the connection guard
    // (its `Drop` disconnects) to end the mutable borrow before we use `remote`
    // again below.
    {
        remote.connect_auth(
            git2::Direction::Fetch,
            Some(callbacks(config_dir.to_path_buf())),
            None,
        )?;
    }
    let default_branch = remote
        .default_branch()?
        .as_str()
        .unwrap_or("refs/heads/main")
        .to_string();

    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(config_dir.to_path_buf()));
    remote.fetch(&[] as &[&str], Some(&mut fo), None)?;

    let branch_name = default_branch
        .strip_prefix("refs/heads/")
        .unwrap_or(&default_branch);
    let remote_ref = format!("refs/remotes/origin/{branch_name}");
    let target = repo.find_reference(&remote_ref)?.peel_to_commit()?;

    let mut local_branch = repo.branch(branch_name, &target, true)?;
    local_branch.set_upstream(Some(&format!("origin/{branch_name}")))?;
    repo.set_head(&format!("refs/heads/{branch_name}"))?;
    repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
    Ok(())
}

/// Ensures the repo-local (untracked, never committed) exclude file always hides
/// klank's own config files and, on Android, the WebView/cache directories that
/// live alongside them. Needed because on Android the clone directory doubles as
/// the app's private data root, so `git_token`/`git_cred_mode` and the whole
/// Chromium profile (cookies, leveldb, HTTP/code caches, prefs, logs) sit right
/// next to the repo content — without this they'd be swept into the first
/// `git add -A` and pushed to the user's remote (the token in plaintext, the rest
/// as multi-megabyte churn on every commit). Same directory names `fs.ts`'s
/// `INTERNAL_DIRS` skips when scanning the tab tree — keep them in sync.
fn ensure_git_excludes(repo: &Repository) -> Result<(), Error> {
    let exclude_path = repo.path().join("info").join("exclude");
    let existing = std::fs::read_to_string(&exclude_path).unwrap_or_default();
    let mut lines: Vec<&str> = existing.lines().collect();
    let mut changed = false;
    for entry in [
        TOKEN_FILE,
        CRED_MODE_FILE,
        "app_webview",
        "cache",
        "code_cache",
        "shared_prefs",
        "no_backup",
        "logs",
        "app_textures",
        "files",
    ] {
        if !lines.contains(&entry) {
            lines.push(entry);
            changed = true;
        }
    }
    if changed {
        if let Some(parent) = exclude_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| Error::from_str(&e.to_string()))?;
        }
        std::fs::write(&exclude_path, lines.join("\n") + "\n")
            .map_err(|e| Error::from_str(&e.to_string()))?;
    }
    Ok(())
}

// ───────────────────────── Unobtrusive auto-sync ─────────────────────────
//
// `git_sync` is the single entry point the app's background loop calls: it
// auto-commits local edits, pulls with rebase, auto-resolves conflicts without
// ever prompting (whole-file "latest commit time wins" for tabs; semantic 3-way
// JSON merge for `.klank-settings.json`), and pushes — so two devices (or two
// people) sharing a tab repo converge seamlessly. A process-wide mutex serializes
// syncs so two never overlap.

const MAX_SYNC_ATTEMPTS: usize = 5;
const SETTINGS_FILE: &str = ".klank-settings.json";
const PLAYLISTS_KEY: &str = "playlists";
/// `GIT_INDEX_ENTRY_STAGEMASK` — bits 12-13 of `IndexEntry::flags` hold the merge stage.
const STAGE_MASK: u16 = 0x3000;

static SYNC_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

#[derive(Serialize, Default)]
pub struct SyncResult {
    pub success: bool,
    pub committed: bool,
    pub pulled: usize,
    pub pushed: usize,
    pub conflicts_resolved: usize,
    pub branch: Option<String>,
    pub up_to_date: bool,
    /// True when the working tree changed underneath the app (so the UI re-hydrates).
    pub changed: bool,
    pub message: String,
    pub error: Option<String>,
    /// Coarse failure category for actionable UI feedback: `"auth"`, `"network"`,
    /// or `"other"`. Only set when `success` is false.
    pub error_kind: Option<String>,
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
}

/// Buckets a libgit2 error so the UI can say whether sync failed on authentication
/// or connectivity (vs. something else) without parsing raw messages on the frontend.
fn classify_error(e: &Error) -> &'static str {
    use git2::ErrorClass;
    let msg = e.message().to_lowercase();
    let auth = matches!(e.class(), ErrorClass::Callback)
        || e.code() == ErrorCode::Auth
        || ["credential", "authentication", "unauthorized", "401", "403"]
            .iter()
            .any(|s| msg.contains(s));
    if auth {
        return "auth";
    }
    let network = matches!(
        e.class(),
        ErrorClass::Net | ErrorClass::Http | ErrorClass::Ssl
    ) || [
        "connect",
        "resolve",
        "timed out",
        "timeout",
        "network",
        "failed to send",
    ]
    .iter()
    .any(|s| msg.contains(s));
    if network {
        "network"
    } else {
        "other"
    }
}

/// Auto-commit → fetch → rebase (auto-resolving conflicts) → push. Never prompts;
/// returns a structured summary of what happened.
pub fn git_sync(config_dir: &Path, dir: &str) -> SyncResult {
    match sync_inner(config_dir, dir) {
        Ok(r) => r,
        Err(e) => SyncResult {
            success: false,
            message: e.message().to_string(),
            error: Some(e.message().to_string()),
            error_kind: Some(classify_error(&e).into()),
            ..Default::default()
        },
    }
}

pub fn git_list_branches(dir: &str) -> Result<Vec<BranchInfo>, String> {
    list_branches_inner(dir).map_err(|e| e.message().to_string())
}

pub fn git_checkout_branch(dir: &str, branch: &str) -> GitResult {
    match checkout_branch_inner(dir, branch) {
        Ok(msg) => GitResult::ok(msg),
        Err(e) => GitResult::err(e),
    }
}

fn sync_inner(config_dir: &Path, dir: &str) -> Result<SyncResult, Error> {
    let _guard = SYNC_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let repo = Repository::discover(dir)?;
    let mut result = SyncResult::default();
    let branch = current_branch_name(&repo)?;
    result.branch = Some(branch.clone());

    // 1. Commit any local edits first so the working tree is clean for rebase.
    let (committed, _msg) = auto_commit(&repo)?;
    result.committed = committed;

    // 2. Fetch. No remote → commit-only success.
    if !fetch_origin(config_dir, &repo, &branch)? {
        result.success = true;
        result.up_to_date = !committed;
        result.message = if committed {
            "Committed locally (no remote)".into()
        } else {
            "No remote configured".into()
        };
        return Ok(result);
    }

    let upstream_ref = format!("refs/remotes/origin/{branch}");

    // 3. No upstream branch yet → first push.
    let Some(mut upstream) = repo
        .find_reference(&upstream_ref)
        .ok()
        .and_then(|r| r.target())
    else {
        push_branch(config_dir, &repo, &branch)?;
        result.pushed = 1;
        result.success = true;
        result.message = format!("Pushed new branch {branch}");
        return Ok(result);
    };

    // 4. Rebase-then-push, retrying if the remote moved under us.
    for attempt in 0..MAX_SYNC_ATTEMPTS {
        let (_ahead, behind) = repo.graph_ahead_behind(head_oid(&repo)?, upstream)?;
        if behind > 0 {
            result.pulled += rebase_onto_upstream(&repo, &branch, upstream, &mut result)?;
        }

        let (ahead, _behind) = repo.graph_ahead_behind(head_oid(&repo)?, upstream)?;
        if ahead == 0 {
            result.up_to_date = !committed && result.pulled == 0;
            finalize_sync(&mut result);
            return Ok(result);
        }

        match push_branch(config_dir, &repo, &branch) {
            Ok(()) => {
                result.pushed = ahead;
                finalize_sync(&mut result);
                return Ok(result);
            }
            Err(e) => {
                let retriable = e.code() == ErrorCode::NotFastForward
                    || e.message().contains("rejected")
                    || e.message().contains("fast-forward");
                if retriable && attempt + 1 < MAX_SYNC_ATTEMPTS {
                    fetch_origin(config_dir, &repo, &branch)?;
                    upstream = repo
                        .find_reference(&upstream_ref)
                        .ok()
                        .and_then(|r| r.target())
                        .unwrap_or(upstream);
                    continue;
                }
                return Err(e);
            }
        }
    }
    Err(Error::from_str("remote moving too fast, try again"))
}

fn head_oid(repo: &Repository) -> Result<Oid, Error> {
    repo.head()?
        .target()
        .ok_or_else(|| Error::from_str("no HEAD"))
}

/// Marks a sync successful and fills in the derived `changed` flag and summary.
fn finalize_sync(result: &mut SyncResult) {
    result.success = true;
    result.changed = result.pulled > 0 || result.conflicts_resolved > 0;
    result.message = sync_message(result);
}

fn sync_message(r: &SyncResult) -> String {
    let mut parts = Vec::new();
    if r.committed {
        parts.push("committed".to_string());
    }
    if r.pulled > 0 {
        parts.push(format!("pulled {}", r.pulled));
    }
    if r.conflicts_resolved > 0 {
        parts.push(format!("auto-merged {}", r.conflicts_resolved));
    }
    if r.pushed > 0 {
        parts.push(format!("pushed {}", r.pushed));
    }
    if parts.is_empty() {
        "Already up to date".into()
    } else {
        parts.join(", ")
    }
}

/// Branch name from HEAD, tolerating an unborn HEAD (fresh repo, no commits yet).
fn current_branch_name(repo: &Repository) -> Result<String, Error> {
    if let Ok(head) = repo.head() {
        return head
            .shorthand()
            .map(str::to_string)
            .ok_or_else(|| Error::from_str("no current branch"));
    }
    if let Ok(reference) = repo.find_reference("HEAD") {
        if let Some(target) = reference.symbolic_target() {
            return Ok(target
                .strip_prefix("refs/heads/")
                .unwrap_or(target)
                .to_string());
        }
    }
    let cfg = repo.config()?;
    Ok(cfg
        .get_string("init.defaultBranch")
        .unwrap_or_else(|_| "main".into()))
}

/// Stages every change (untracked, modified, deleted) and commits. `.gitignore` is
/// honored. Returns whether anything was committed and the generated message.
fn auto_commit(repo: &Repository) -> Result<(bool, String), Error> {
    ensure_git_excludes(repo)?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts))?;
    if statuses.is_empty() {
        return Ok((false, String::new()));
    }
    let (mut added, mut modified, mut deleted) = (0usize, 0usize, 0usize);
    for e in statuses.iter() {
        let s = e.status();
        if s.is_wt_new() || s.is_index_new() {
            added += 1;
        } else if s.is_wt_deleted() || s.is_index_deleted() {
            deleted += 1;
        } else {
            modified += 1;
        }
    }

    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.update_all(["*"].iter(), None)?; // records working-tree deletions
    index.write()?;
    let tree = repo.find_tree(index.write_tree()?)?;
    let sig = signature(repo)?;
    let parent = repo
        .head()
        .ok()
        .and_then(|h| h.target())
        .and_then(|o| repo.find_commit(o).ok());
    let parents: Vec<&Commit> = parent.iter().collect();
    let total = added + modified + deleted;
    let msg = format!(
        "klank sync: {total} changed (A{added} M{modified} D{deleted}) @ {}",
        chrono::Utc::now().to_rfc3339()
    );
    repo.commit(Some("HEAD"), &sig, &sig, &msg, &tree, &parents)?;
    Ok((true, msg))
}

/// Fetches `origin` for `branch`. Returns `false` when there is no `origin` remote.
fn fetch_origin(config_dir: &Path, repo: &Repository, branch: &str) -> Result<bool, Error> {
    let mut remote = match repo.find_remote("origin") {
        Ok(r) => r,
        Err(_) => return Ok(false),
    };
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(config_dir.to_path_buf()));
    remote.fetch(&[branch], Some(&mut fo), None)?;
    Ok(true)
}

/// Pushes `branch` to `origin`, surfacing a non-fast-forward rejection as an error
/// (so the caller can re-fetch/re-rebase). Never force-pushes.
fn push_branch(config_dir: &Path, repo: &Repository, branch: &str) -> Result<(), Error> {
    let mut remote = repo.find_remote("origin")?;
    let rejected = std::rc::Rc::new(std::cell::RefCell::new(None::<String>));
    let mut cb = callbacks(config_dir.to_path_buf());
    {
        let rejected = rejected.clone();
        cb.push_update_reference(move |refname, status| {
            if let Some(s) = status {
                *rejected.borrow_mut() = Some(format!("{refname}: {s}"));
            }
            Ok(())
        });
    }
    let mut po = PushOptions::new();
    po.remote_callbacks(cb);
    remote.push(
        &[format!("refs/heads/{branch}:refs/heads/{branch}")],
        Some(&mut po),
    )?;
    if let Some(msg) = rejected.borrow().clone() {
        return Err(Error::from_str(&format!("push rejected: {msg}")));
    }
    Ok(())
}

/// Integrates upstream into the local branch and leaves a linear history that the
/// remote can fast-forward to. Rather than drive libgit2's rebase state machine
/// (whose in-memory `commit` ignores manual index edits), we 3-way `merge_trees`,
/// auto-resolve conflicts in the resulting index, and write one squashed commit
/// parented on the upstream tip. Returns the number of upstream commits integrated.
fn rebase_onto_upstream(
    repo: &Repository,
    branch: &str,
    upstream_oid: Oid,
    result: &mut SyncResult,
) -> Result<usize, Error> {
    let local_oid = head_oid(repo)?;
    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;
    if behind == 0 {
        return Ok(0); // already contains upstream; nothing to integrate
    }

    let refname = format!("refs/heads/{branch}");

    // Pure fast-forward: no local commits to preserve, just move to upstream.
    if ahead == 0 {
        repo.reference(&refname, upstream_oid, true, "klank sync: fast-forward")?;
        repo.set_head(&refname)?;
        repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
        return Ok(behind);
    }

    // Diverged: 3-way merge local (ours) with upstream (theirs).
    let local_commit = repo.find_commit(local_oid)?;
    let upstream_commit = repo.find_commit(upstream_oid)?;
    let base_oid = repo.merge_base(local_oid, upstream_oid)?;
    let base_tree = repo.find_commit(base_oid)?.tree()?;
    let local_tree = local_commit.tree()?;
    let upstream_tree = upstream_commit.tree()?;

    let mut merged = repo.merge_trees(&base_tree, &local_tree, &upstream_tree, None)?;
    let local_newer = local_commit.time().seconds() >= upstream_commit.time().seconds(); // tie → local
                                                                                         // Resolve every path changed on BOTH sides ourselves — overriding libgit2's
                                                                                         // line-level text auto-merge so tabs follow whole-file "latest wins" and the
                                                                                         // settings file always gets the semantic JSON merge (not a fragile line merge).
    resolve_dual_changes(
        &mut merged,
        repo,
        &base_tree,
        &local_tree,
        &upstream_tree,
        local_newer,
        result,
    )?;
    // Safety net for anything the tree diff couldn't name (e.g. non-UTF-8 paths).
    if merged.has_conflicts() {
        resolve_conflicts(&mut merged, repo, local_newer, result)?;
    }

    let tree = repo.find_tree(merged.write_tree_to(repo)?)?;
    let sig = signature(repo)?;
    // Detached create (parent = upstream, not the current tip), then force the ref.
    let new_oid = repo.commit(
        None,
        &sig,
        &sig,
        "klank sync: merge local changes",
        &tree,
        &[&upstream_commit],
    )?;
    repo.reference(&refname, new_oid, true, "klank sync: integrate")?;
    repo.set_head(&refname)?;
    repo.checkout_head(Some(CheckoutBuilder::new().force()))?;
    Ok(behind)
}

/// Auto-resolves every conflict in a `merge_trees` index, where ours (stage 2) is
/// the local side and theirs (stage 3) is the remote (upstream) side. `.klank-settings.json`
/// gets a semantic 3-way JSON merge; everything else is whole-file "latest commit
/// time wins" (a deleted winning side leaves the path removed).
fn resolve_conflicts(
    index: &mut Index,
    repo: &Repository,
    local_newer: bool,
    result: &mut SyncResult,
) -> Result<(), Error> {
    let conflicts: Vec<IndexConflict> = index.conflicts()?.collect::<Result<_, _>>()?;
    for c in &conflicts {
        let path = conflict_path(c);
        result.conflicts_resolved += 1;
        let local = c.our.as_ref();
        let remote = c.their.as_ref();

        if is_settings_path(&path) {
            let base = blob_for(repo, c.ancestor.as_ref())?;
            let local_bytes = blob_for(repo, local)?;
            let remote_bytes = blob_for(repo, remote)?;
            if let Some(bytes) = merge_settings_json(
                base.as_deref(),
                local_bytes.as_deref(),
                remote_bytes.as_deref(),
                local_newer,
            ) {
                let template = local.or(remote).or(c.ancestor.as_ref());
                index.remove_path(Path::new(&path))?;
                if let Some(t) = template {
                    let mut entry = entry_at_stage0(t);
                    entry.id = repo.blob(&bytes)?;
                    entry.file_size = bytes.len() as u32;
                    index.add(&entry)?;
                }
                continue;
            }
            // All sides unparseable — fall through to whole-file latest-wins.
        }

        let winner = if local_newer { local } else { remote };
        index.remove_path(Path::new(&path))?;
        if let Some(entry) = winner {
            index.add(&entry_at_stage0(entry))?; // re-add winning blob at stage 0
        }
    }
    Ok(())
}

/// Deterministically resolves every path changed on both sides relative to the
/// merge base, overriding libgit2's text auto-merge. `.klank-settings.json` gets the
/// semantic 3-way JSON merge; every other path (tabs included) is whole-file "latest
/// commit time wins" — a deleted winning side leaves the path removed.
fn resolve_dual_changes(
    index: &mut Index,
    repo: &Repository,
    base_tree: &Tree,
    local_tree: &Tree,
    upstream_tree: &Tree,
    local_newer: bool,
    result: &mut SyncResult,
) -> Result<(), Error> {
    let local_changed = changed_paths(repo, base_tree, local_tree)?;
    let remote_changed = changed_paths(repo, base_tree, upstream_tree)?;
    for path in local_changed.intersection(&remote_changed) {
        let p = Path::new(path);
        let local_entry = local_tree.get_path(p).ok();
        let remote_entry = upstream_tree.get_path(p).ok();
        // Both sides converged on identical content → merge_trees already has it.
        if let (Some(l), Some(r)) = (&local_entry, &remote_entry) {
            if l.id() == r.id() {
                continue;
            }
        }
        result.conflicts_resolved += 1;
        index.remove_path(p)?;

        if is_settings_path(path) {
            let base = blob_bytes_at(repo, base_tree, p)?;
            let local_b = blob_bytes_at(repo, local_tree, p)?;
            let remote_b = blob_bytes_at(repo, upstream_tree, p)?;
            if let Some(bytes) = merge_settings_json(
                base.as_deref(),
                local_b.as_deref(),
                remote_b.as_deref(),
                local_newer,
            ) {
                let oid = repo.blob(&bytes)?;
                index.add(&make_index_entry(path, oid, 0o100644))?;
                continue;
            }
            // All sides unparseable — fall through to whole-file latest-wins.
        }

        let winner = if local_newer {
            local_entry.as_ref()
        } else {
            remote_entry.as_ref()
        };
        if let Some(e) = winner {
            index.add(&make_index_entry(path, e.id(), e.filemode() as u32))?;
        }
        // else: the winning side deleted the file → leave it removed.
    }
    Ok(())
}

/// Paths that differ between `base` and `other` (added, modified, or deleted).
fn changed_paths(repo: &Repository, base: &Tree, other: &Tree) -> Result<BTreeSet<String>, Error> {
    let diff = repo.diff_tree_to_tree(Some(base), Some(other), None)?;
    let mut out = BTreeSet::new();
    for d in diff.deltas() {
        for f in [d.new_file().path(), d.old_file().path()]
            .into_iter()
            .flatten()
        {
            if let Some(s) = f.to_str() {
                out.insert(s.to_string());
            }
        }
    }
    Ok(out)
}

fn blob_bytes_at(repo: &Repository, tree: &Tree, path: &Path) -> Result<Option<Vec<u8>>, Error> {
    match tree.get_path(path) {
        Ok(entry) => Ok(Some(repo.find_blob(entry.id())?.content().to_vec())),
        Err(_) => Ok(None),
    }
}

/// Builds a fresh stage-0 index entry for `path` pointing at an existing blob.
fn make_index_entry(path: &str, oid: Oid, mode: u32) -> git2::IndexEntry {
    git2::IndexEntry {
        ctime: git2::IndexTime::new(0, 0),
        mtime: git2::IndexTime::new(0, 0),
        dev: 0,
        ino: 0,
        mode,
        uid: 0,
        gid: 0,
        file_size: 0,
        id: oid,
        flags: 0,
        flags_extended: 0,
        path: path.as_bytes().to_vec(),
    }
}

/// Rebuilds an index entry at merge stage 0 (`IndexEntry` is not `Clone` in git2).
fn entry_at_stage0(src: &git2::IndexEntry) -> git2::IndexEntry {
    git2::IndexEntry {
        ctime: src.ctime,
        mtime: src.mtime,
        dev: src.dev,
        ino: src.ino,
        mode: src.mode,
        uid: src.uid,
        gid: src.gid,
        file_size: src.file_size,
        id: src.id,
        flags: src.flags & !STAGE_MASK,
        flags_extended: src.flags_extended,
        path: src.path.clone(),
    }
}

fn conflict_path(c: &IndexConflict) -> String {
    let bytes = c
        .our
        .as_ref()
        .or(c.their.as_ref())
        .or(c.ancestor.as_ref())
        .map(|e| e.path.clone())
        .unwrap_or_default();
    String::from_utf8_lossy(&bytes).into_owned()
}

fn is_settings_path(path: &str) -> bool {
    path.replace('\\', "/").ends_with(SETTINGS_FILE)
}

fn blob_for(repo: &Repository, entry: Option<&git2::IndexEntry>) -> Result<Option<Vec<u8>>, Error> {
    match entry {
        Some(e) => Ok(Some(repo.find_blob(e.id)?.content().to_vec())),
        None => Ok(None),
    }
}

/// Semantic 3-way merge of `.klank-settings.json`. Returns `None` only when every
/// side is unparseable (caller then falls back to whole-file). Output mirrors the
/// frontend writer: sorted keys, 2-space indent (see `libs/platform-api/.../fs.ts`).
fn merge_settings_json(
    base: Option<&[u8]>,
    local: Option<&[u8]>,
    remote: Option<&[u8]>,
    local_newer: bool,
) -> Option<Vec<u8>> {
    let parse = |b: Option<&[u8]>| -> Option<Map<String, Value>> {
        b.and_then(|x| serde_json::from_slice::<Value>(x).ok())
            .and_then(|v| v.as_object().cloned())
    };
    let (base_v, local_v, remote_v) = (parse(base), parse(local), parse(remote));
    if base_v.is_none() && local_v.is_none() && remote_v.is_none() {
        return None;
    }
    let base_m = base_v.unwrap_or_default();
    let local_m = local_v.unwrap_or_default();
    let remote_m = remote_v.unwrap_or_default();

    let mut keys: BTreeSet<&String> = BTreeSet::new();
    keys.extend(base_m.keys());
    keys.extend(local_m.keys());
    keys.extend(remote_m.keys());

    let mut out = Map::new();
    for key in keys {
        let (b, l, r) = (base_m.get(key), local_m.get(key), remote_m.get(key));
        let merged = if key == PLAYLISTS_KEY {
            merge_playlists(b, l, r, local_newer)
        } else {
            three_way_value(b, l, r, local_newer)
        };
        if let Some(v) = merged {
            out.insert(key.clone(), v);
        }
    }
    serde_json::to_vec_pretty(&Value::Object(out)).ok()
}

/// Classic 3-way merge of a single JSON value. `None` means "absent" (a deletion);
/// returning `None` omits the key. On a true both-sides-changed conflict the
/// latest-commit-time side wins.
fn three_way_value(
    base: Option<&Value>,
    local: Option<&Value>,
    remote: Option<&Value>,
    local_newer: bool,
) -> Option<Value> {
    if local == remote {
        return local.cloned();
    }
    if local == base {
        return remote.cloned(); // local unchanged → take remote (possibly a deletion)
    }
    if remote == base {
        return local.cloned(); // remote unchanged → take local
    }
    if local_newer {
        local.cloned()
    } else {
        remote.cloned()
    }
}

/// Merges the `playlists` array by playlist `id`, 3-way per playlist, ordering the
/// result by `createdAt` then `id` for stable, minimal diffs.
fn merge_playlists(
    base: Option<&Value>,
    local: Option<&Value>,
    remote: Option<&Value>,
    local_newer: bool,
) -> Option<Value> {
    let by_id = |v: Option<&Value>| -> BTreeMap<String, Value> {
        let mut m = BTreeMap::new();
        if let Some(Value::Array(arr)) = v {
            for item in arr {
                if let Some(id) = item.get("id").and_then(Value::as_str) {
                    m.insert(id.to_string(), item.clone());
                }
            }
        }
        m
    };
    let (base_m, local_m, remote_m) = (by_id(base), by_id(local), by_id(remote));
    let mut ids: BTreeSet<&String> = BTreeSet::new();
    ids.extend(base_m.keys());
    ids.extend(local_m.keys());
    ids.extend(remote_m.keys());

    let mut merged: Vec<Value> = ids
        .into_iter()
        .filter_map(|id| {
            three_way_value(
                base_m.get(id),
                local_m.get(id),
                remote_m.get(id),
                local_newer,
            )
        })
        .collect();
    merged.sort_by(|a, b| {
        let ca = a.get("createdAt").and_then(Value::as_i64).unwrap_or(0);
        let cb = b.get("createdAt").and_then(Value::as_i64).unwrap_or(0);
        ca.cmp(&cb).then_with(|| {
            let ia = a.get("id").and_then(Value::as_str).unwrap_or("");
            let ib = b.get("id").and_then(Value::as_str).unwrap_or("");
            ia.cmp(ib)
        })
    });
    Some(Value::Array(merged))
}

fn list_branches_inner(dir: &str) -> Result<Vec<BranchInfo>, Error> {
    let repo = Repository::discover(dir)?;
    let mut out: Vec<BranchInfo> = Vec::new();
    for b in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = b?;
        let Some(name) = branch.name()?.map(str::to_string) else {
            continue;
        };
        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(str::to_string));
        out.push(BranchInfo {
            name,
            is_head: branch.is_head(),
            is_remote: false,
            upstream,
        });
    }
    let local: BTreeSet<String> = out.iter().map(|b| b.name.clone()).collect();
    for b in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = b?;
        let Some(full) = branch.name()?.map(str::to_string) else {
            continue;
        };
        if full.ends_with("/HEAD") {
            continue;
        }
        let short = full.strip_prefix("origin/").unwrap_or(&full).to_string();
        if local.contains(&short) {
            continue;
        }
        out.push(BranchInfo {
            name: short,
            is_head: false,
            is_remote: true,
            upstream: None,
        });
    }
    Ok(out)
}

/// Switches HEAD to `branch`. Creates a local tracking branch from `origin/<branch>`
/// when only the remote-tracking ref exists. Uses a safe checkout so it never
/// clobbers uncommitted work (the app calls `git_sync` first to commit).
fn checkout_branch_inner(dir: &str, branch: &str) -> Result<String, Error> {
    let repo = Repository::discover(dir)?;
    let local_ref = format!("refs/heads/{branch}");
    if repo.find_reference(&local_ref).is_err() {
        let remote = repo
            .find_reference(&format!("refs/remotes/origin/{branch}"))
            .map_err(|_| Error::from_str("no such branch"))?
            .peel_to_commit()?;
        let mut local = repo.branch(branch, &remote, false)?;
        let _ = local.set_upstream(Some(&format!("origin/{branch}")));
    }
    let obj = repo.revparse_single(&local_ref)?;
    repo.checkout_tree(&obj, Some(CheckoutBuilder::new().safe()))?;
    repo.set_head(&local_ref)?;
    Ok(format!("Switched to {branch}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Time;
    use std::path::PathBuf;

    fn temp_repo() -> (PathBuf, Repository) {
        let mut p = std::env::temp_dir();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        p.push(format!("klank-git-test-{}-{}", std::process::id(), nanos));
        std::fs::create_dir_all(&p).unwrap();
        let repo = Repository::init(&p).unwrap();
        let mut cfg = repo.config().unwrap();
        cfg.set_str("user.name", "Test").unwrap();
        cfg.set_str("user.email", "test@klank").unwrap();
        (p, repo)
    }

    fn write(dir: &Path, name: &str, content: &str) {
        std::fs::write(dir.join(name), content).unwrap();
    }

    fn commit_all(repo: &Repository, msg: &str, secs: i64) -> Oid {
        let mut index = repo.index().unwrap();
        index
            .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
            .unwrap();
        index.update_all(["*"].iter(), None).unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let sig = Signature::new("Test", "test@klank", &Time::new(secs, 0)).unwrap();
        let parent = repo
            .head()
            .ok()
            .and_then(|h| h.target())
            .and_then(|o| repo.find_commit(o).ok());
        let parents: Vec<&Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents)
            .unwrap()
    }

    /// Checks out the `local` branch and resets the working tree to it.
    fn switch_to_local(repo: &Repository) {
        repo.set_head("refs/heads/local").unwrap();
        let obj = repo.revparse_single("refs/heads/local").unwrap();
        repo.reset(&obj, git2::ResetType::Hard, None).unwrap();
    }

    // ── Pure JSON 3-way merge ───────────────────────────────────────────────

    #[test]
    fn json_merge_disjoint_keys_both_survive() {
        let merged = merge_settings_json(
            Some(br#"{}"#),
            Some(br#"{"a.tab.txt":{"fontSize":1}}"#),
            Some(br#"{"b.tab.txt":{"fontSize":2}}"#),
            true,
        )
        .unwrap();
        let v: Value = serde_json::from_slice(&merged).unwrap();
        assert!(v.get("a.tab.txt").is_some(), "local-only key must survive");
        assert!(v.get("b.tab.txt").is_some(), "remote-only key must survive");
    }

    #[test]
    fn json_merge_conflict_prefers_newer() {
        let (base, local, remote) = (
            br#"{"k":{"fontSize":1}}"#.as_slice(),
            br#"{"k":{"fontSize":2}}"#.as_slice(),
            br#"{"k":{"fontSize":3}}"#.as_slice(),
        );
        let local_wins = merge_settings_json(Some(base), Some(local), Some(remote), true).unwrap();
        let v: Value = serde_json::from_slice(&local_wins).unwrap();
        assert_eq!(v["k"]["fontSize"], 2);

        let remote_wins =
            merge_settings_json(Some(base), Some(local), Some(remote), false).unwrap();
        let v: Value = serde_json::from_slice(&remote_wins).unwrap();
        assert_eq!(v["k"]["fontSize"], 3);
    }

    #[test]
    fn json_merge_playlists_by_id() {
        let merged = merge_settings_json(
            Some(br#"{"playlists":[]}"#),
            Some(br#"{"playlists":[{"id":"1","name":"L","paths":[],"createdAt":1}]}"#),
            Some(br#"{"playlists":[{"id":"2","name":"R","paths":[],"createdAt":2}]}"#),
            true,
        )
        .unwrap();
        let v: Value = serde_json::from_slice(&merged).unwrap();
        let arr = v["playlists"].as_array().unwrap();
        assert_eq!(arr.len(), 2, "playlists from both sides merge by id");
        assert_eq!(arr[0]["id"], "1"); // ordered by createdAt
        assert_eq!(arr[1]["id"], "2");
    }

    #[test]
    fn json_output_is_sorted_2space() {
        let merged = merge_settings_json(
            Some(br#"{}"#),
            Some(br#"{"b":1,"a":2}"#),
            Some(br#"{}"#),
            true,
        )
        .unwrap();
        let s = String::from_utf8(merged).unwrap();
        assert!(s.contains("\n  \"a\""), "2-space indent expected: {s}");
        assert!(
            s.find("\"a\"").unwrap() < s.find("\"b\"").unwrap(),
            "keys must be sorted"
        );
    }

    #[test]
    fn json_merge_all_unparseable_returns_none() {
        assert!(merge_settings_json(Some(b"not json"), Some(b"also bad"), None, true).is_none());
    }

    // ── Real libgit2 rebase + auto-resolution ───────────────────────────────

    #[test]
    fn rebase_auto_resolves_tab_and_settings() {
        let (dir, repo) = temp_repo();

        write(&dir, "song.tab.txt", "BASE");
        write(
            &dir,
            ".klank-settings.json",
            r#"{"Z.tab.txt":{"fontSize":10,"transpose":0,"scrollSpeed":1}}"#,
        );
        let base = commit_all(&repo, "base", 1000);

        let base_commit = repo.find_commit(base).unwrap();
        repo.branch("local", &base_commit, false).unwrap();

        // Remote side (commit A) — newer (secs 3000).
        write(&dir, "song.tab.txt", "A_VERSION");
        write(
            &dir,
            ".klank-settings.json",
            r#"{"X.tab.txt":{"fontSize":15,"transpose":0,"scrollSpeed":1},"Z.tab.txt":{"fontSize":20,"transpose":0,"scrollSpeed":1}}"#,
        );
        let main_oid = commit_all(&repo, "A", 3000);

        // Local side (commit B) — older (secs 2000), diverged.
        switch_to_local(&repo);
        write(&dir, "song.tab.txt", "B_VERSION");
        write(
            &dir,
            ".klank-settings.json",
            r#"{"Y.tab.txt":{"fontSize":25,"transpose":0,"scrollSpeed":1},"Z.tab.txt":{"fontSize":30,"transpose":0,"scrollSpeed":1}}"#,
        );
        commit_all(&repo, "B", 2000);

        let mut result = SyncResult::default();
        let integrated = rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();
        assert_eq!(integrated, 1);
        assert!(
            result.conflicts_resolved >= 2,
            "tab + settings both conflicted"
        );

        // Whole-file tab: remote (A @3000) is newer than local (B @2000) → A wins.
        let tab = std::fs::read_to_string(dir.join("song.tab.txt")).unwrap();
        assert_eq!(tab, "A_VERSION");

        let settings: Value = serde_json::from_str(
            &std::fs::read_to_string(dir.join(".klank-settings.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            settings["Z.tab.txt"]["fontSize"], 20,
            "conflict → newer (A) wins"
        );
        assert!(settings.get("X.tab.txt").is_some(), "A-only key survives");
        assert!(settings.get("Y.tab.txt").is_some(), "B-only key survives");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebase_whole_file_local_newer_wins() {
        let (dir, repo) = temp_repo();
        write(&dir, "song.tab.txt", "BASE");
        let base = commit_all(&repo, "base", 1000);
        repo.branch("local", &repo.find_commit(base).unwrap(), false)
            .unwrap();

        write(&dir, "song.tab.txt", "REMOTE");
        let main_oid = commit_all(&repo, "remote", 2000);

        switch_to_local(&repo);
        write(&dir, "song.tab.txt", "LOCAL");
        commit_all(&repo, "local", 5000); // newer than remote

        let mut result = SyncResult::default();
        rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();
        let tab = std::fs::read_to_string(dir.join("song.tab.txt")).unwrap();
        assert_eq!(tab, "LOCAL", "local commit newer → local wins");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebase_same_tab_disjoint_lines_takes_whole_latest() {
        // Both sides edit *different lines* of the same tab. libgit2's text merge
        // would splice them; our whole-file "latest wins" must take the newer side
        // verbatim instead.
        let (dir, repo) = temp_repo();
        write(&dir, "song.tab.txt", "L1\nL2\nL3\n");
        let base = commit_all(&repo, "base", 1000);
        repo.branch("local", &repo.find_commit(base).unwrap(), false)
            .unwrap();

        write(&dir, "song.tab.txt", "R1\nL2\nL3\n"); // remote edits line 1
        let main_oid = commit_all(&repo, "remote", 2000);

        switch_to_local(&repo);
        write(&dir, "song.tab.txt", "L1\nL2\nL3-local\n"); // local edits line 3, newer
        commit_all(&repo, "local", 5000);

        let mut result = SyncResult::default();
        rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();
        assert_eq!(result.conflicts_resolved, 1);
        assert_eq!(
            std::fs::read_to_string(dir.join("song.tab.txt")).unwrap(),
            "L1\nL2\nL3-local\n",
            "newer side wins the whole file — no line splicing",
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebase_clean_merge_keeps_both_sides() {
        let (dir, repo) = temp_repo();
        write(&dir, "a.tab.txt", "A0");
        write(&dir, "b.tab.txt", "B0");
        let base = commit_all(&repo, "base", 1000);
        repo.branch("local", &repo.find_commit(base).unwrap(), false)
            .unwrap();

        // Remote edits a different file than local → no conflict.
        write(&dir, "b.tab.txt", "B-REMOTE");
        let main_oid = commit_all(&repo, "remote", 2000);

        switch_to_local(&repo);
        write(&dir, "a.tab.txt", "A-LOCAL");
        commit_all(&repo, "local", 3000);

        let mut result = SyncResult::default();
        rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();
        assert_eq!(
            result.conflicts_resolved, 0,
            "disjoint edits must not conflict"
        );
        assert_eq!(
            std::fs::read_to_string(dir.join("a.tab.txt")).unwrap(),
            "A-LOCAL"
        );
        assert_eq!(
            std::fs::read_to_string(dir.join("b.tab.txt")).unwrap(),
            "B-REMOTE"
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebase_produces_linear_fast_forwardable_history() {
        let (dir, repo) = temp_repo();
        write(&dir, "song.tab.txt", "BASE");
        let base = commit_all(&repo, "base", 1000);
        repo.branch("local", &repo.find_commit(base).unwrap(), false)
            .unwrap();
        write(&dir, "song.tab.txt", "REMOTE");
        let main_oid = commit_all(&repo, "remote", 2000);
        switch_to_local(&repo);
        write(&dir, "song.tab.txt", "LOCAL");
        commit_all(&repo, "local", 3000);

        let mut result = SyncResult::default();
        rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();

        // The integrated tip has exactly one parent: the upstream tip → the remote
        // can fast-forward to it (no merge commit, linear history).
        let tip = repo.find_commit(head_oid(&repo).unwrap()).unwrap();
        assert_eq!(tip.parent_count(), 1);
        assert_eq!(tip.parent_id(0).unwrap(), main_oid);

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebase_fast_forwards_when_no_local_commits() {
        let (dir, repo) = temp_repo();
        write(&dir, "song.tab.txt", "BASE");
        let base = commit_all(&repo, "base", 1000);
        repo.branch("local", &repo.find_commit(base).unwrap(), false)
            .unwrap();
        write(&dir, "song.tab.txt", "REMOTE");
        let main_oid = commit_all(&repo, "remote", 2000);
        switch_to_local(&repo); // local is purely behind, no local commits

        let mut result = SyncResult::default();
        let integrated = rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();
        assert_eq!(integrated, 1);
        assert_eq!(result.conflicts_resolved, 0);
        // Pure fast-forward: local now points exactly at the upstream tip.
        assert_eq!(repo.refname_to_id("refs/heads/local").unwrap(), main_oid);
        assert_eq!(
            std::fs::read_to_string(dir.join("song.tab.txt")).unwrap(),
            "REMOTE"
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebase_delete_modify_latest_wins() {
        let (dir, repo) = temp_repo();
        write(&dir, "song.tab.txt", "BASE");
        let base = commit_all(&repo, "base", 1000);
        repo.branch("local", &repo.find_commit(base).unwrap(), false)
            .unwrap();

        // Remote modifies the file (older); local deletes it (newer) → deletion wins.
        write(&dir, "song.tab.txt", "REMOTE-EDIT");
        let main_oid = commit_all(&repo, "remote", 2000);
        switch_to_local(&repo);
        std::fs::remove_file(dir.join("song.tab.txt")).unwrap();
        commit_all(&repo, "local-delete", 5000);

        let mut result = SyncResult::default();
        rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();
        assert!(result.conflicts_resolved >= 1);
        assert!(
            !dir.join("song.tab.txt").exists(),
            "newer side deleted → file removed"
        );

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn classify_error_buckets_auth_network_and_other() {
        use git2::{ErrorClass, ErrorCode};
        let auth_code = Error::new(ErrorCode::Auth, ErrorClass::None, "denied");
        assert_eq!(classify_error(&auth_code), "auth");
        let auth_cb = Error::new(
            ErrorCode::GenericError,
            ErrorClass::Callback,
            "no usable git credentials",
        );
        assert_eq!(classify_error(&auth_cb), "auth");
        let auth_msg = Error::from_str("remote: Authentication failed for repo");
        assert_eq!(classify_error(&auth_msg), "auth");

        let net_class = Error::new(ErrorCode::GenericError, ErrorClass::Net, "boom");
        assert_eq!(classify_error(&net_class), "network");
        let net_msg = Error::from_str("failed to connect to github.com: could not resolve host");
        assert_eq!(classify_error(&net_msg), "network");

        let other = Error::from_str("some merge weirdness");
        assert_eq!(classify_error(&other), "other");
    }

    #[test]
    fn json_merge_same_playlist_edited_both_sides_takes_newer() {
        let base = br#"{"playlists":[{"id":"1","name":"A","paths":[],"createdAt":1}]}"#.as_slice();
        let local =
            br#"{"playlists":[{"id":"1","name":"A","paths":["x"],"createdAt":1}]}"#.as_slice();
        let remote =
            br#"{"playlists":[{"id":"1","name":"A","paths":["y"],"createdAt":1}]}"#.as_slice();

        let merged = merge_settings_json(Some(base), Some(local), Some(remote), true).unwrap();
        let v: Value = serde_json::from_slice(&merged).unwrap();
        assert_eq!(
            v["playlists"][0]["paths"],
            serde_json::json!(["x"]),
            "newer side's playlist wins"
        );
    }

    #[test]
    fn current_branch_name_handles_unborn_head() {
        let (dir, repo) = temp_repo(); // freshly init'd: HEAD is unborn
        let name = current_branch_name(&repo).unwrap();
        assert!(
            !name.is_empty(),
            "unborn HEAD still yields a default branch name"
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn json_merge_key_deleted_by_newer_side_is_removed() {
        let base = br#"{"k":{"fontSize":1}}"#.as_slice();
        let local = br#"{}"#.as_slice(); // local removed k
        let remote = br#"{"k":{"fontSize":1}}"#.as_slice();

        // Local (deletion) is newer → key removed.
        let removed = merge_settings_json(Some(base), Some(local), Some(remote), true).unwrap();
        let v: Value = serde_json::from_slice(&removed).unwrap();
        assert!(v.get("k").is_none(), "newer deletion removes the key");

        // Remote (unchanged) is newer → deletion still wins because remote == base.
        let kept = merge_settings_json(Some(base), Some(local), Some(remote), false).unwrap();
        let v: Value = serde_json::from_slice(&kept).unwrap();
        assert!(
            v.get("k").is_none(),
            "remote unchanged from base → local deletion applies"
        );
    }
}
