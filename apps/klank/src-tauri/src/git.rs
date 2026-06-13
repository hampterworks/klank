//! In-app git engine backed by libgit2 (`git2`).
//!
//! Replaces the desktop-only shell `git` so sync works on Android too, where no
//! `git` binary exists. HTTPS authentication uses a Personal Access Token stored
//! in the app-private config dir when set (required on Android), otherwise the
//! system credential helper (desktop). The token is never logged and never
//! written into remote URLs.

use git2::{
    build::{CheckoutBuilder, RepoBuilder},
    Cred, CredentialType, Error, FetchOptions, PushOptions, RemoteCallbacks, Repository,
    Signature, StatusOptions,
};
use serde::Serialize;
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
