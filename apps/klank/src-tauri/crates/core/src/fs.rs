//! File & settings engine (platform-free core).
//!
//! This is the Rust port of the Tauri `FileService` in
//! `libs/platform-api/src/lib/fs.ts`, so `klank-server` behaves byte-for-byte
//! like the desktop app when they share the same git repo:
//!
//! - **Tree**: recursive walk keeping directories + `*.tab.txt` files, skipping
//!   dot-dirs and the [`INTERNAL_DIRS`] (the Android WebView/cache tree).
//! - **Settings**: `.klank-settings.json` stores **relative, forward-slash,
//!   sorted** keys on disk (portable across machines sharing the repo); the API
//!   boundary converts rel↔abs. Reserved keys `playlists`/`playMetrics` are
//!   excluded from per-tab reads. The legacy `.klankrc.json` migration runs on
//!   the first settings read.
//! - **Path guard**: every wire path is validated against the canonicalized
//!   tabs root (rejecting `..`, NUL, and symlink escapes); mutations require the
//!   `.tab.txt` extension.
//!
//! Settings-file writes are serialized by a single [`tokio::sync::Mutex`] owned
//! by the caller (the server's `AppState`), mirroring the desktop `withSettingsLock`.

use serde::Serialize;
use serde_json::{Map, Value};
use std::path::{Component, Path, PathBuf};
use tokio::sync::Mutex;

const SETTINGS_FILE: &str = ".klank-settings.json";
const LEGACY_RC_FILE: &str = ".klankrc.json";
const PLAYLISTS_KEY: &str = "playlists";
const PLAY_METRICS_KEY: &str = "playMetrics";
const TAB_EXT: &str = ".tab.txt";

/// Directory names that live alongside tabs in the Android app-data root and
/// must never be scanned (the Chromium cache tree is huge and can throw on
/// `read_dir`). Same list as `fs.ts` `INTERNAL_DIRS` and `git.rs`
/// `ensure_git_excludes` — keep the three in sync.
const INTERNAL_DIRS: [&str; 8] = [
    "app_webview",
    "cache",
    "code_cache",
    "shared_prefs",
    "no_backup",
    "logs",
    "app_textures",
    "files",
];

/// A file-system operation error, carrying the HTTP status the server maps it to.
#[derive(Debug)]
pub enum FsError {
    /// Invalid path/params → `400`.
    BadRequest(String),
    /// Missing file → `404`.
    NotFound(String),
    /// Anything else → `500`.
    Internal(String),
}

impl FsError {
    pub fn message(&self) -> &str {
        match self {
            FsError::BadRequest(m) | FsError::NotFound(m) | FsError::Internal(m) => m,
        }
    }
    fn bad(m: impl Into<String>) -> Self {
        FsError::BadRequest(m.into())
    }
}

// ── Path resolution / traversal guard ───────────────────────────────────────

/// Validates a wire path against `tabs_dir` and returns the (lexical) absolute
/// path to operate on. Rejects `..` components and NUL, and requires the
/// canonicalized target to stay under the canonicalized tabs root — which
/// defeats a symlink that points outside the library. The returned path is the
/// lexical (non-canonicalized) path so it stays identical to the keys the tree
/// and settings emit (which are `tabs_dir`-relative, not symlink-resolved).
pub fn resolve(tabs_dir: &Path, path: &str) -> Result<PathBuf, FsError> {
    if path.contains('\0') {
        return Err(FsError::bad("path contains NUL"));
    }
    resolve_path(tabs_dir, Path::new(path))
}

fn resolve_path(tabs_dir: &Path, raw: &Path) -> Result<PathBuf, FsError> {
    if raw.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(FsError::bad("path contains a parent-directory component"));
    }
    let root = tabs_dir
        .canonicalize()
        .map_err(|e| FsError::Internal(format!("tabs dir unavailable: {e}")))?;
    let abs = if raw.is_absolute() {
        raw.to_path_buf()
    } else {
        tabs_dir.join(raw)
    };
    let check =
        canonicalize_lenient(&abs).ok_or_else(|| FsError::bad("path could not be resolved"))?;
    if !check.starts_with(&root) {
        return Err(FsError::bad("path escapes the tabs root"));
    }
    Ok(abs)
}

/// Canonicalizes the deepest **existing** ancestor of `p` and re-appends the
/// not-yet-existing tail, so a to-be-created file resolves through any symlink
/// in its existing parents (closing the "create through a symlink" escape) while
/// still resolving for paths that don't exist yet.
fn canonicalize_lenient(p: &Path) -> Option<PathBuf> {
    if let Ok(c) = p.canonicalize() {
        return Some(c);
    }
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    let mut cur = p;
    loop {
        let parent = cur.parent()?;
        tail.push(cur.file_name()?.to_os_string());
        if let Ok(mut resolved) = parent.canonicalize() {
            for name in tail.iter().rev() {
                resolved.push(name);
            }
            return Some(resolved);
        }
        if parent.as_os_str().is_empty() {
            return None;
        }
        cur = parent;
    }
}

fn require_tab_ext(path: &Path) -> Result<(), FsError> {
    if path.to_string_lossy().ends_with(TAB_EXT) {
        Ok(())
    } else {
        Err(FsError::bad("mutations require a .tab.txt file"))
    }
}

// ── Tree ─────────────────────────────────────────────────────────────────────

/// A recursive directory entry. Serializes to the `RecursiveDirEntry` JSON shape
/// in the server contract: directories carry `children`, files omit it.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeEntry {
    pub name: String,
    pub is_directory: bool,
    pub is_file: bool,
    pub is_symlink: bool,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<TreeEntry>>,
}

/// Recursively reads `tabs_dir`, keeping directories + `*.tab.txt` files, skipping
/// dot-dirs and [`INTERNAL_DIRS`]. An unreadable subdirectory degrades to
/// `children: []` rather than failing the whole scan (matches `fs.ts`).
pub fn read_tree(tabs_dir: &Path) -> Vec<TreeEntry> {
    walk(tabs_dir)
}

fn walk(dir: &Path) -> Vec<TreeEntry> {
    let mut entries: Vec<TreeEntry> = Vec::new();
    let read = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(_) => return entries,
    };
    for entry in read.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        let ft = match entry.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        let path = entry.path().to_string_lossy().to_string();
        if ft.is_dir() {
            if name.starts_with('.') || INTERNAL_DIRS.contains(&name.as_str()) {
                continue;
            }
            entries.push(TreeEntry {
                name,
                is_directory: true,
                is_file: false,
                is_symlink: false,
                path,
                children: Some(walk(&entry.path())),
            });
        } else if ft.is_file() && name.ends_with(TAB_EXT) {
            entries.push(TreeEntry {
                name,
                is_directory: false,
                is_file: true,
                is_symlink: ft.is_symlink(),
                path,
                children: None,
            });
        }
    }
    // Stable, name-sorted output (readdir order is OS-dependent).
    entries.sort_by(|a, b| a.name.cmp(&b.name));
    entries
}

// ── File CRUD ────────────────────────────────────────────────────────────────

/// Reads a tab file's UTF-8 content. `404` when the file is missing.
pub fn read_file(tabs_dir: &Path, path: &str) -> Result<String, FsError> {
    let resolved = resolve(tabs_dir, path)?;
    if resolved.is_dir() {
        return Err(FsError::BadRequest("path is a directory".into()));
    }
    std::fs::read_to_string(&resolved).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => FsError::NotFound("file not found".into()),
        _ => FsError::Internal(e.to_string()),
    })
}

/// Writes `content` to `filename` inside `target` (an absolute dir under the
/// root). Returns the full path written. Requires a `.tab.txt` filename.
pub fn write_file(
    tabs_dir: &Path,
    target: &str,
    filename: &str,
    content: &str,
) -> Result<String, FsError> {
    let raw = Path::new(target).join(filename);
    let resolved = resolve_path(tabs_dir, &raw)?;
    require_tab_ext(&resolved)?;
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent).map_err(|e| FsError::Internal(e.to_string()))?;
    }
    std::fs::write(&resolved, content).map_err(|e| FsError::Internal(e.to_string()))?;
    Ok(resolved.to_string_lossy().to_string())
}

/// Deletes a tab file. `404` when it is already gone (the client treats a
/// missing file as success, matching desktop). Requires a `.tab.txt` path.
pub fn delete_file(tabs_dir: &Path, path: &str) -> Result<(), FsError> {
    let resolved = resolve(tabs_dir, path)?;
    require_tab_ext(&resolved)?;
    std::fs::remove_file(&resolved).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => FsError::NotFound("file not found".into()),
        _ => FsError::Internal(e.to_string()),
    })
}

/// Whether `path` exists on disk.
pub fn path_exists(tabs_dir: &Path, path: &str) -> Result<bool, FsError> {
    Ok(resolve(tabs_dir, path)?.exists())
}

// ── Relative ↔ absolute key conversion (ports fs.ts) ────────────────────────

fn is_absolute_key(key: &str) -> bool {
    key.starts_with('/')
        || key
            .as_bytes()
            .first()
            .is_some_and(|c| c.is_ascii_alphabetic())
            && key.as_bytes().get(1) == Some(&b':')
}

fn to_relative_key(abs_path: &str, base: &str) -> String {
    let norm = abs_path.replace('\\', "/");
    let norm_base = base.replace('\\', "/");
    let norm_base = norm_base.trim_end_matches('/');
    let prefix = format!("{norm_base}/");
    if norm.starts_with(&prefix) {
        norm[prefix.len()..].to_string()
    } else {
        norm
    }
}

fn to_abs_path(rel_key: &str, base: &str) -> String {
    let sep = if base.contains('\\') { '\\' } else { '/' };
    if is_absolute_key(rel_key) {
        return rel_key.replace('/', &sep.to_string());
    }
    let os_rel = rel_key.replace('/', &sep.to_string());
    let base_trimmed = base.trim_end_matches(['/', '\\']);
    format!("{base_trimmed}{sep}{os_rel}")
}

// ── Settings file I/O ────────────────────────────────────────────────────────

fn settings_path(tabs_dir: &Path) -> PathBuf {
    tabs_dir.join(SETTINGS_FILE)
}

/// Reads the raw settings map (relative keys). Empty on any error / missing file.
fn read_map(tabs_dir: &Path) -> Map<String, Value> {
    std::fs::read_to_string(settings_path(tabs_dir))
        .ok()
        .and_then(|c| serde_json::from_str::<Value>(&c).ok())
        .and_then(|v| v.as_object().cloned())
        .unwrap_or_default()
}

/// Writes the settings map. `serde_json::Map` is a `BTreeMap`, so keys are
/// always sorted and the 2-space pretty output matches `JSON.stringify(x,null,2)`.
fn write_map(tabs_dir: &Path, map: Map<String, Value>) -> Result<(), FsError> {
    let s = serde_json::to_string_pretty(&Value::Object(map))
        .map_err(|e| FsError::Internal(e.to_string()))?;
    std::fs::write(settings_path(tabs_dir), s).map_err(|e| FsError::Internal(e.to_string()))
}

/// Ports the `.klankrc.json` → `.klank-settings.json` migration from fs.ts:
/// detects the tab paths' common directory prefix, rewrites keys relative to it,
/// merges over any existing (relative-keyed) settings, and blanks the legacy
/// file so it runs only once. Best-effort; errors are swallowed.
fn migrate_legacy(tabs_dir: &Path) {
    let legacy_path = tabs_dir.join(LEGACY_RC_FILE);
    let Ok(content) = std::fs::read_to_string(&legacy_path) else {
        return;
    };
    let Ok(Value::Object(legacy)) = serde_json::from_str::<Value>(&content) else {
        return;
    };

    let raw_keys: Vec<&String> = legacy.keys().filter(|k| k.ends_with(TAB_EXT)).collect();
    if raw_keys.is_empty() {
        return;
    }

    // Longest common directory prefix across all (forward-slashed) tab paths.
    let dir_of =
        |k: &str| -> String { k.rfind('/').map(|i| k[..i].to_string()).unwrap_or_default() };
    let norm_keys: Vec<String> = raw_keys.iter().map(|k| k.replace('\\', "/")).collect();
    let dirs: Vec<String> = norm_keys.iter().map(|k| dir_of(k)).collect();
    let mut tab_dir = dirs[0].clone();
    for dir in &dirs[1..] {
        while !tab_dir.is_empty() && dir != &tab_dir && !dir.starts_with(&format!("{tab_dir}/")) {
            tab_dir = dir_of(&tab_dir);
        }
    }

    let mut migrated: Map<String, Value> = Map::new();
    for (raw_key, entry) in &legacy {
        if !raw_key.ends_with(TAB_EXT) {
            continue;
        }
        let norm_key = raw_key.replace('\\', "/");
        let rel_key = if !tab_dir.is_empty() && norm_key.starts_with(&format!("{tab_dir}/")) {
            norm_key[tab_dir.len() + 1..].to_string()
        } else {
            norm_key[norm_key.rfind('/').map(|i| i + 1).unwrap_or(0)..].to_string()
        };
        let mut obj = Map::new();
        for f in ["fontSize", "transpose", "scrollSpeed"] {
            if let Some(v) = entry.get(f) {
                obj.insert(f.to_string(), v.clone());
            }
        }
        migrated.insert(rel_key, Value::Object(obj));
    }

    // Existing relative-keyed settings win over migrated ones; stale absolute
    // keys from an earlier buggy migration are dropped.
    let mut merged = migrated;
    for (k, v) in read_map(tabs_dir) {
        if !is_absolute_key(&k) {
            merged.insert(k, v);
        }
    }
    let _ = write_map(tabs_dir, merged);
    let _ = std::fs::write(&legacy_path, "{}");
}

// ── Settings API (abs keys at the boundary; locked writes) ───────────────────

/// Reads per-tab settings, keyed by absolute path, reserved keys excluded. Runs
/// the legacy migration first (under the lock, since it may write the file).
pub async fn read_settings(tabs_dir: &Path, lock: &Mutex<()>) -> Map<String, Value> {
    let _guard = lock.lock().await;
    migrate_legacy(tabs_dir);
    let base = tabs_dir.to_string_lossy();
    read_map(tabs_dir)
        .into_iter()
        .filter(|(k, _)| k != PLAYLISTS_KEY && k != PLAY_METRICS_KEY)
        .map(|(k, v)| (to_abs_path(&k, &base), v))
        .collect()
}

/// Persists one tab's settings (absolute `tab_path` stored relative, sorted).
pub async fn write_tab_setting(
    tabs_dir: &Path,
    lock: &Mutex<()>,
    tab_path: &str,
    settings: Value,
) -> Result<(), FsError> {
    let _guard = lock.lock().await;
    let base = tabs_dir.to_string_lossy();
    let mut map = read_map(tabs_dir);
    map.insert(to_relative_key(tab_path, &base), settings);
    write_map(tabs_dir, map)
}

/// Removes one tab's settings entry. Silently succeeds when absent.
pub async fn delete_tab_setting(
    tabs_dir: &Path,
    lock: &Mutex<()>,
    tab_path: &str,
) -> Result<(), FsError> {
    let _guard = lock.lock().await;
    let base = tabs_dir.to_string_lossy();
    let mut map = read_map(tabs_dir);
    let rel = to_relative_key(tab_path, &base);
    if map.remove(&rel).is_none() {
        return Ok(());
    }
    write_map(tabs_dir, map)
}

fn convert_playlist_paths(mut pl: Value, convert: &dyn Fn(&str) -> String) -> Value {
    if let Some(paths) = pl.get_mut("paths").and_then(|p| p.as_array_mut()) {
        for p in paths.iter_mut() {
            if let Some(s) = p.as_str() {
                *p = Value::String(convert(s));
            }
        }
    }
    pl
}

/// Reads playlists (paths absolute). Empty when the file/key is absent.
pub async fn read_playlists(tabs_dir: &Path, lock: &Mutex<()>) -> Vec<Value> {
    let _guard = lock.lock().await;
    let base = tabs_dir.to_string_lossy().to_string();
    match read_map(tabs_dir).get(PLAYLISTS_KEY) {
        Some(Value::Array(arr)) => arr
            .iter()
            .cloned()
            .map(|pl| convert_playlist_paths(pl, &|s| to_abs_path(s, &base)))
            .collect(),
        _ => Vec::new(),
    }
}

/// Persists all playlists (paths stored relative), leaving other keys untouched.
pub async fn write_playlists(
    tabs_dir: &Path,
    lock: &Mutex<()>,
    playlists: Vec<Value>,
) -> Result<(), FsError> {
    let _guard = lock.lock().await;
    let base = tabs_dir.to_string_lossy().to_string();
    let mut map = read_map(tabs_dir);
    let rel: Vec<Value> = playlists
        .into_iter()
        .map(|pl| convert_playlist_paths(pl, &|s| to_relative_key(s, &base)))
        .collect();
    map.insert(PLAYLISTS_KEY.to_string(), Value::Array(rel));
    write_map(tabs_dir, map)
}

/// Reads play metrics, keyed by absolute path. Empty when the file/key is absent.
pub async fn read_play_metrics(tabs_dir: &Path, lock: &Mutex<()>) -> Map<String, Value> {
    let _guard = lock.lock().await;
    let base = tabs_dir.to_string_lossy();
    match read_map(tabs_dir).get(PLAY_METRICS_KEY) {
        Some(Value::Object(m)) => m
            .iter()
            .map(|(k, v)| (to_abs_path(k, &base), v.clone()))
            .collect(),
        _ => Map::new(),
    }
}

/// Persists all play metrics (keys stored relative), leaving other keys untouched.
pub async fn write_play_metrics(
    tabs_dir: &Path,
    lock: &Mutex<()>,
    metrics: Map<String, Value>,
) -> Result<(), FsError> {
    let _guard = lock.lock().await;
    let base = tabs_dir.to_string_lossy();
    let mut map = read_map(tabs_dir);
    let rel: Map<String, Value> = metrics
        .into_iter()
        .map(|(k, v)| (to_relative_key(&k, &base), v))
        .collect();
    map.insert(PLAY_METRICS_KEY.to_string(), Value::Object(rel));
    write_map(tabs_dir, map)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn tempdir() -> PathBuf {
        let mut p = std::env::temp_dir();
        let nanos = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        p.push(format!("klank-fs-test-{}-{}", std::process::id(), nanos));
        std::fs::create_dir_all(&p).unwrap();
        p
    }

    // ── Path traversal guard ────────────────────────────────────────────────

    #[test]
    fn rejects_parent_dir_and_accepts_nested_tab() {
        let root = tempdir();
        std::fs::create_dir_all(root.join("sub")).unwrap();
        std::fs::write(root.join("sub/a.tab.txt"), "x").unwrap();

        assert!(resolve(&root, &format!("{}/../escape", root.display())).is_err());
        let nested = root.join("sub/a.tab.txt");
        assert!(resolve(&root, &nested.to_string_lossy()).is_ok());

        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn rejects_absolute_path_outside_root() {
        let root = tempdir();
        let outside = std::env::temp_dir().join("definitely-not-under-root.tab.txt");
        assert!(resolve(&root, &outside.to_string_lossy()).is_err());
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn rejects_nul_byte() {
        let root = tempdir();
        assert!(resolve(&root, "foo\0bar").is_err());
        std::fs::remove_dir_all(&root).ok();
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_escape() {
        let root = tempdir();
        let secret = std::env::temp_dir().join(format!("klank-secret-{}", std::process::id()));
        std::fs::create_dir_all(&secret).unwrap();
        std::os::unix::fs::symlink(&secret, root.join("link")).unwrap();
        // A path that traverses the symlink lands outside the root → rejected.
        let escaped = root.join("link/stolen.tab.txt");
        assert!(resolve(&root, &escaped.to_string_lossy()).is_err());
        std::fs::remove_dir_all(&root).ok();
        std::fs::remove_dir_all(&secret).ok();
    }

    // ── Tree filtering ──────────────────────────────────────────────────────

    #[test]
    fn tree_keeps_tabs_and_dirs_skips_internal_and_dot() {
        let root = tempdir();
        std::fs::write(root.join("A - Song.tab.txt"), "x").unwrap();
        std::fs::write(root.join("notes.txt"), "x").unwrap(); // non-tab → skipped
        std::fs::create_dir_all(root.join("cache")).unwrap(); // INTERNAL → skipped
        std::fs::create_dir_all(root.join(".git")).unwrap(); // dot-dir → skipped
        std::fs::create_dir_all(root.join("Rock")).unwrap();
        std::fs::write(root.join("Rock/B - Riff.tab.txt"), "x").unwrap();

        let tree = read_tree(&root);
        let names: Vec<&str> = tree.iter().map(|e| e.name.as_str()).collect();
        assert!(names.contains(&"A - Song.tab.txt"));
        assert!(names.contains(&"Rock"));
        assert!(!names.contains(&"notes.txt"));
        assert!(!names.contains(&"cache"));
        assert!(!names.contains(&".git"));
        let rock = tree.iter().find(|e| e.name == "Rock").unwrap();
        assert_eq!(rock.children.as_ref().unwrap().len(), 1);

        std::fs::remove_dir_all(&root).ok();
    }

    // ── Settings read-modify-write ──────────────────────────────────────────

    #[tokio::test]
    async fn settings_roundtrip_sorted_and_reserved_excluded() {
        let root = tempdir();
        let lock = Mutex::new(());
        let base = root.to_string_lossy().to_string();

        // Native-separator absolute keys (forward-slash on the Linux server;
        // backslash on Windows) — the engine derives the separator from `base`.
        let path_b = root.join("B - b.tab.txt").to_string_lossy().to_string();
        let path_a = root.join("A - a.tab.txt").to_string_lossy().to_string();
        write_tab_setting(
            &root,
            &lock,
            &path_b,
            json!({"fontSize":2,"transpose":0,"scrollSpeed":1}),
        )
        .await
        .unwrap();
        write_tab_setting(
            &root,
            &lock,
            &path_a,
            json!({"fontSize":1,"transpose":0,"scrollSpeed":1}),
        )
        .await
        .unwrap();
        // A reserved key must not appear as a per-tab entry.
        write_playlists(
            &root,
            &lock,
            vec![json!({"id":"1","name":"L","paths":[],"createdAt":1})],
        )
        .await
        .unwrap();

        let settings = read_settings(&root, &lock).await;
        assert!(settings.contains_key(&path_a));
        assert!(settings.contains_key(&path_b));
        assert!(!settings.keys().any(|k| k.ends_with("playlists")));

        // On disk: relative, sorted keys (A before B).
        let raw = std::fs::read_to_string(root.join(SETTINGS_FILE)).unwrap();
        assert!(raw.find("A - a.tab.txt").unwrap() < raw.find("B - b.tab.txt").unwrap());
        assert!(!raw.contains(&base), "keys stored relative, not absolute");

        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn playlists_paths_roundtrip_abs() {
        let root = tempdir();
        let lock = Mutex::new(());
        let abs = root.join("X - y.tab.txt").to_string_lossy().to_string();
        write_playlists(
            &root,
            &lock,
            vec![json!({"id":"1","name":"L","paths":[abs.clone()],"createdAt":1})],
        )
        .await
        .unwrap();

        // Stored relative on disk.
        let raw = std::fs::read_to_string(root.join(SETTINGS_FILE)).unwrap();
        assert!(raw.contains("X - y.tab.txt"));
        assert!(!raw.contains(&abs));

        // Read back absolute.
        let out = read_playlists(&root, &lock).await;
        assert_eq!(out[0]["paths"][0], json!(abs));

        std::fs::remove_dir_all(&root).ok();
    }

    #[tokio::test]
    async fn migrates_legacy_klankrc() {
        let root = tempdir();
        let lock = Mutex::new(());
        std::fs::write(
            root.join(LEGACY_RC_FILE),
            r#"{"/old/machine/Song.tab.txt":{"fontSize":9,"transpose":1,"scrollSpeed":2}}"#,
        )
        .unwrap();

        let settings = read_settings(&root, &lock).await;
        // Key rewritten relative to the detected prefix → basename only here.
        assert!(settings.keys().any(|k| k.ends_with("Song.tab.txt")));
        // Legacy file blanked so migration runs once.
        assert_eq!(
            std::fs::read_to_string(root.join(LEGACY_RC_FILE)).unwrap(),
            "{}"
        );

        std::fs::remove_dir_all(&root).ok();
    }
}
