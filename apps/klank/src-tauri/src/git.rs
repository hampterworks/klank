//! In-app git engine backed by libgit2 (`git2`).
//!
//! Replaces the desktop-only shell `git` so sync works on Android too, where no
//! `git` binary exists. HTTPS authentication uses a Personal Access Token stored
//! in the app-private config dir when set (required on Android), otherwise the
//! system credential helper (desktop). The token is never logged and never
//! written into remote URLs.

use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    BranchType, Commit, Cred, CredentialType, Error, ErrorCode, FetchOptions, Index, IndexConflict,
    Oid, PushOptions, RemoteCallbacks, Repository, Signature, StatusOptions,
};
use serde::Serialize;
use serde_json::{Map, Value};
use std::collections::{BTreeMap, BTreeSet};
use std::path::Path;
use tauri::Manager;

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
        Self { success: true, output: output.into(), error: None }
    }
    fn err(e: Error) -> Self {
        Self { success: false, output: String::new(), error: Some(e.message().to_string()) }
    }
}

const TOKEN_FILE: &str = "git_token";

fn token_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join(TOKEN_FILE))
}

fn read_token(app: &tauri::AppHandle) -> Option<String> {
    let t = std::fs::read_to_string(token_path(app)?).ok()?.trim().to_string();
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

fn cred_mode_path(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join(CRED_MODE_FILE))
}

fn system_credentials_enabled(app: &tauri::AppHandle) -> bool {
    cred_mode_path(app).map(|p| p.exists()).unwrap_or(false)
}

fn set_system_credentials(app: &tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let path = cred_mode_path(app).ok_or("no config directory")?;
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

/// Stores (or, when empty, clears) the HTTPS Personal Access Token used for
/// push/pull/clone. Written app-private with `0600` perms on unix.
#[tauri::command]
pub fn git_set_token(app: tauri::AppHandle, token: String) -> Result<(), String> {
    let path = token_path(&app).ok_or("no config directory")?;
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
#[tauri::command]
pub fn git_has_token(app: tauri::AppHandle) -> bool {
    read_token(&app).is_some()
}

/// Whether sync has any usable authentication: a stored PAT, or the user has opted
/// into the OS credential helper. The frontend gates sync on this (not on the PAT
/// alone) so a configured helper works with no token.
#[tauri::command]
pub fn git_is_authenticated(app: tauri::AppHandle) -> bool {
    read_token(&app).is_some() || system_credentials_enabled(&app)
}

/// Whether the user has opted into the OS credential helper.
#[tauri::command]
pub fn git_system_credentials_enabled(app: tauri::AppHandle) -> bool {
    system_credentials_enabled(&app)
}

/// Desktop one-click sign-in: verifies the OS git credential helper can authenticate
/// against the repo's `origin` (this is what triggers Git Credential Manager's
/// interactive login on first use), and on success records that auth is configured.
#[tauri::command]
pub fn git_use_system_credentials(app: tauri::AppHandle, dir: String) -> GitResult {
    match probe_system_credentials(&dir) {
        Ok(()) => match set_system_credentials(&app, true) {
            Ok(()) => GitResult::ok("Using system Git credentials"),
            Err(e) => GitResult { success: false, output: String::new(), error: Some(e) },
        },
        Err(e) => GitResult::err(e),
    }
}

/// Turns off the system-credential opt-in (does not touch any stored PAT).
#[tauri::command]
pub fn git_disable_system_credentials(app: tauri::AppHandle) -> Result<(), String> {
    set_system_credentials(&app, false)
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

/// Builds credential callbacks: PAT first (Android + as an override), then the
/// system credential helper (desktop).
fn callbacks(app: tauri::AppHandle) -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    let mut used_token = false;
    cb.credentials(move |url, username, allowed| {
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if !used_token {
                if let Some(token) = read_token(&app) {
                    used_token = true;
                    // GitHub & friends accept the PAT as the password with any user.
                    return Cred::userpass_plaintext(username.unwrap_or("git"), &token);
                }
            }
            if let Ok(config) = git2::Config::open_default() {
                if let Ok(cred) = Cred::credential_helper(&config, url, username) {
                    return Ok(cred);
                }
            }
        }
        if allowed.contains(CredentialType::DEFAULT) {
            return Cred::default();
        }
        Err(Error::from_str(
            "no usable git credentials — set a token in Settings",
        ))
    });
    cb
}

/// Credential callbacks that use ONLY the OS credential helper (no stored PAT), so
/// the "Use system Git credentials" probe genuinely tests the helper.
fn callbacks_system_only() -> RemoteCallbacks<'static> {
    let mut cb = RemoteCallbacks::new();
    cb.credentials(move |url, username, allowed| {
        if allowed.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(config) = git2::Config::open_default() {
                if let Ok(cred) = Cred::credential_helper(&config, url, username) {
                    return Ok(cred);
                }
            }
        }
        if allowed.contains(CredentialType::DEFAULT) {
            return Cred::default();
        }
        Err(Error::from_str("no system git credentials"))
    });
    cb
}

#[tauri::command]
pub fn git_is_repo(dir: String) -> bool {
    Repository::discover(&dir).is_ok()
}

#[tauri::command]
pub fn git_status(dir: String) -> Result<Vec<GitChangedFile>, String> {
    let repo = Repository::discover(&dir).map_err(|e| e.message().to_string())?;
    let mut opts = StatusOptions::new();
    opts.include_untracked(true).recurse_untracked_dirs(true);
    let statuses = repo.statuses(Some(&mut opts)).map_err(|e| e.message().to_string())?;
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

#[tauri::command]
pub fn git_commit(dir: String, message: String) -> GitResult {
    match commit_inner(&dir, &message) {
        Ok(()) => GitResult::ok("committed"),
        Err(e) => GitResult::err(e),
    }
}

fn commit_inner(dir: &str, message: &str) -> Result<(), Error> {
    let repo = Repository::discover(dir)?;
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
    let name = cfg.get_string("user.name").unwrap_or_else(|_| "klank".into());
    let email = cfg.get_string("user.email").unwrap_or_else(|_| "klank@localhost".into());
    Signature::now(&name, &email)
}

#[tauri::command]
pub fn git_pull(app: tauri::AppHandle, dir: String) -> GitResult {
    match pull_inner(app, &dir) {
        Ok(msg) => GitResult::ok(msg),
        Err(e) => GitResult::err(e),
    }
}

fn pull_inner(app: tauri::AppHandle, dir: &str) -> Result<String, Error> {
    let repo = Repository::discover(dir)?;
    let head = repo.head()?;
    let branch = head.shorthand().ok_or_else(|| Error::from_str("no current branch"))?.to_string();

    let mut remote = repo.find_remote("origin")?;
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(app));
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

#[tauri::command]
pub fn git_push(app: tauri::AppHandle, dir: String) -> GitResult {
    match push_inner(app, &dir) {
        Ok(msg) => GitResult::ok(msg),
        Err(e) => GitResult::err(e),
    }
}

fn push_inner(app: tauri::AppHandle, dir: &str) -> Result<String, Error> {
    let repo = Repository::discover(dir)?;
    let head = repo.head()?;
    let branch = head.shorthand().ok_or_else(|| Error::from_str("no current branch"))?.to_string();
    let mut remote = repo.find_remote("origin")?;
    let mut po = PushOptions::new();
    po.remote_callbacks(callbacks(app));
    remote.push(&[format!("refs/heads/{branch}:refs/heads/{branch}")], Some(&mut po))?;
    Ok(format!("Pushed {branch}"))
}

#[tauri::command]
pub fn git_unpushed(dir: String) -> Result<Vec<String>, String> {
    unpushed_inner(&dir).map_err(|e| e.message().to_string())
}

fn unpushed_inner(dir: &str) -> Result<Vec<String>, Error> {
    let repo = Repository::discover(dir)?;
    let head = repo.head()?;
    let Some(local) = head.target() else {
        return Ok(vec![]);
    };
    let branch = head.shorthand().ok_or_else(|| Error::from_str("no current branch"))?;
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
        out.push(format!("{} {}", &oid.to_string()[..7], commit.summary().unwrap_or("")));
    }
    Ok(out)
}

#[tauri::command]
pub fn git_clone(app: tauri::AppHandle, url: String, dir: String) -> GitResult {
    match clone_inner(app, &url, &dir) {
        Ok(()) => GitResult::ok("Cloned"),
        Err(e) => GitResult::err(e),
    }
}

fn clone_inner(app: tauri::AppHandle, url: &str, dir: &str) -> Result<(), Error> {
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(app));
    let mut builder = RepoBuilder::new();
    builder.fetch_options(fo);
    builder.clone(url, Path::new(dir))?;
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
}

#[derive(Serialize)]
pub struct BranchInfo {
    pub name: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
}

/// Auto-commit → fetch → rebase (auto-resolving conflicts) → push. Never prompts;
/// returns a structured summary of what happened.
#[tauri::command]
pub fn git_sync(app: tauri::AppHandle, dir: String) -> SyncResult {
    match sync_inner(&app, &dir) {
        Ok(r) => r,
        Err(e) => SyncResult {
            success: false,
            message: e.message().to_string(),
            error: Some(e.message().to_string()),
            ..Default::default()
        },
    }
}

#[tauri::command]
pub fn git_list_branches(dir: String) -> Result<Vec<BranchInfo>, String> {
    list_branches_inner(&dir).map_err(|e| e.message().to_string())
}

#[tauri::command]
pub fn git_checkout_branch(dir: String, branch: String) -> GitResult {
    match checkout_branch_inner(&dir, &branch) {
        Ok(msg) => GitResult::ok(msg),
        Err(e) => GitResult::err(e),
    }
}

fn sync_inner(app: &tauri::AppHandle, dir: &str) -> Result<SyncResult, Error> {
    let _guard = SYNC_LOCK.lock().unwrap_or_else(|p| p.into_inner());
    let repo = Repository::discover(dir)?;
    let mut result = SyncResult::default();
    let branch = current_branch_name(&repo)?;
    result.branch = Some(branch.clone());

    // 1. Commit any local edits first so the working tree is clean for rebase.
    let (committed, _msg) = auto_commit(&repo)?;
    result.committed = committed;

    // 2. Fetch. No remote → commit-only success.
    if !fetch_origin(app, &repo, &branch)? {
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
    let Some(mut upstream) = repo.find_reference(&upstream_ref).ok().and_then(|r| r.target()) else {
        push_branch(app, &repo, &branch)?;
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
            result.success = true;
            result.up_to_date = !committed && result.pulled == 0;
            result.changed = result.pulled > 0 || result.conflicts_resolved > 0;
            result.message = sync_message(&result);
            return Ok(result);
        }

        match push_branch(app, &repo, &branch) {
            Ok(()) => {
                result.pushed = ahead;
                result.success = true;
                result.changed = result.pulled > 0 || result.conflicts_resolved > 0;
                result.message = sync_message(&result);
                return Ok(result);
            }
            Err(e) => {
                let retriable = e.code() == ErrorCode::NotFastForward
                    || e.message().contains("rejected")
                    || e.message().contains("fast-forward");
                if retriable && attempt + 1 < MAX_SYNC_ATTEMPTS {
                    fetch_origin(app, &repo, &branch)?;
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
    repo.head()?.target().ok_or_else(|| Error::from_str("no HEAD"))
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
            return Ok(target.strip_prefix("refs/heads/").unwrap_or(target).to_string());
        }
    }
    let cfg = repo.config()?;
    Ok(cfg.get_string("init.defaultBranch").unwrap_or_else(|_| "main".into()))
}

/// Stages every change (untracked, modified, deleted) and commits. `.gitignore` is
/// honored. Returns whether anything was committed and the generated message.
fn auto_commit(repo: &Repository) -> Result<(bool, String), Error> {
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
    let parent = repo.head().ok().and_then(|h| h.target()).and_then(|o| repo.find_commit(o).ok());
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
fn fetch_origin(app: &tauri::AppHandle, repo: &Repository, branch: &str) -> Result<bool, Error> {
    let mut remote = match repo.find_remote("origin") {
        Ok(r) => r,
        Err(_) => return Ok(false),
    };
    let mut fo = FetchOptions::new();
    fo.remote_callbacks(callbacks(app.clone()));
    remote.fetch(&[branch], Some(&mut fo), None)?;
    Ok(true)
}

/// Pushes `branch` to `origin`, surfacing a non-fast-forward rejection as an error
/// (so the caller can re-fetch/re-rebase). Never force-pushes.
fn push_branch(app: &tauri::AppHandle, repo: &Repository, branch: &str) -> Result<(), Error> {
    let mut remote = repo.find_remote("origin")?;
    let rejected = std::rc::Rc::new(std::cell::RefCell::new(None::<String>));
    let mut cb = callbacks(app.clone());
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
    remote.push(&[format!("refs/heads/{branch}:refs/heads/{branch}")], Some(&mut po))?;
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
    if merged.has_conflicts() {
        // merge_trees: ours (stage 2) = local, theirs (stage 3) = upstream.
        let local_newer =
            local_commit.time().seconds() >= upstream_commit.time().seconds(); // tie → local
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
        .filter_map(|id| three_way_value(base_m.get(id), local_m.get(id), remote_m.get(id), local_newer))
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
        let Some(name) = branch.name()?.map(str::to_string) else { continue };
        let upstream = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(str::to_string));
        out.push(BranchInfo { name, is_head: branch.is_head(), is_remote: false, upstream });
    }
    let local: BTreeSet<String> = out.iter().map(|b| b.name.clone()).collect();
    for b in repo.branches(Some(BranchType::Remote))? {
        let (branch, _) = b?;
        let Some(full) = branch.name()?.map(str::to_string) else { continue };
        if full.ends_with("/HEAD") {
            continue;
        }
        let short = full.strip_prefix("origin/").unwrap_or(&full).to_string();
        if local.contains(&short) {
            continue;
        }
        out.push(BranchInfo { name: short, is_head: false, is_remote: true, upstream: None });
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
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None).unwrap();
        index.update_all(["*"].iter(), None).unwrap();
        index.write().unwrap();
        let tree = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let sig = Signature::new("Test", "test@klank", &Time::new(secs, 0)).unwrap();
        let parent = repo.head().ok().and_then(|h| h.target()).and_then(|o| repo.find_commit(o).ok());
        let parents: Vec<&Commit> = parent.iter().collect();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &parents).unwrap()
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

        let remote_wins = merge_settings_json(Some(base), Some(local), Some(remote), false).unwrap();
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
        let merged =
            merge_settings_json(Some(br#"{}"#), Some(br#"{"b":1,"a":2}"#), Some(br#"{}"#), true).unwrap();
        let s = String::from_utf8(merged).unwrap();
        assert!(s.contains("\n  \"a\""), "2-space indent expected: {s}");
        assert!(s.find("\"a\"").unwrap() < s.find("\"b\"").unwrap(), "keys must be sorted");
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
        repo.set_head("refs/heads/local").unwrap();
        let local_obj = repo.revparse_single("refs/heads/local").unwrap();
        repo.reset(&local_obj, git2::ResetType::Hard, None).unwrap();
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
        assert!(result.conflicts_resolved >= 2, "tab + settings both conflicted");

        // Whole-file tab: remote (A @3000) is newer than local (B @2000) → A wins.
        let tab = std::fs::read_to_string(dir.join("song.tab.txt")).unwrap();
        assert_eq!(tab, "A_VERSION");

        let settings: Value =
            serde_json::from_str(&std::fs::read_to_string(dir.join(".klank-settings.json")).unwrap())
                .unwrap();
        assert_eq!(settings["Z.tab.txt"]["fontSize"], 20, "conflict → newer (A) wins");
        assert!(settings.get("X.tab.txt").is_some(), "A-only key survives");
        assert!(settings.get("Y.tab.txt").is_some(), "B-only key survives");

        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn rebase_whole_file_local_newer_wins() {
        let (dir, repo) = temp_repo();
        write(&dir, "song.tab.txt", "BASE");
        let base = commit_all(&repo, "base", 1000);
        repo.branch("local", &repo.find_commit(base).unwrap(), false).unwrap();

        write(&dir, "song.tab.txt", "REMOTE");
        let main_oid = commit_all(&repo, "remote", 2000);

        repo.set_head("refs/heads/local").unwrap();
        let local_obj = repo.revparse_single("refs/heads/local").unwrap();
        repo.reset(&local_obj, git2::ResetType::Hard, None).unwrap();
        write(&dir, "song.tab.txt", "LOCAL");
        commit_all(&repo, "local", 5000); // newer than remote

        let mut result = SyncResult::default();
        rebase_onto_upstream(&repo, "local", main_oid, &mut result).unwrap();
        let tab = std::fs::read_to_string(dir.join("song.tab.txt")).unwrap();
        assert_eq!(tab, "LOCAL", "local commit newer → local wins");

        std::fs::remove_dir_all(&dir).ok();
    }
}
