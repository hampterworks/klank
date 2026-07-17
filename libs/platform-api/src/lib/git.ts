import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './platform'

export type GitChangedFile = { status: string; path: string }
export type GitResult = { success: boolean; output: string; error?: string }

/** Coarse failure category for actionable UI feedback. */
export type SyncErrorKind = 'auth' | 'network' | 'other'

/** Structured outcome of an auto-sync (commit → pull-rebase → push). */
export type SyncResult = {
  success: boolean
  committed: boolean
  pulled: number
  pushed: number
  conflictsResolved: number
  branch?: string
  upToDate: boolean
  /** True when the working tree changed underneath the app, so it should re-hydrate. */
  changed: boolean
  message: string
  error?: string
  /** Failure category (only set when `success` is false). */
  errorKind?: SyncErrorKind
}

export type BranchInfo = {
  name: string
  isHead: boolean
  isRemote: boolean
  upstream?: string
}

export type GitService = {
  isGitRepo: (dir: string) => Promise<boolean>
  getChangedFiles: (dir: string) => Promise<GitChangedFile[]>
  pull: (dir: string) => Promise<GitResult>
  commit: (dir: string, message: string) => Promise<GitResult>
  push: (dir: string) => Promise<GitResult>
  getUnpushedCommits: (dir: string) => Promise<string[]>
  /**
   * Unobtrusive auto-sync: auto-commits local edits, pulls with rebase
   * (auto-resolving conflicts — latest commit time wins for tabs, 3-way JSON
   * merge for config), and pushes. Never prompts.
   */
  sync: (dir: string) => Promise<SyncResult>
  /** Lists local (and remote-only) branches so the user can pick one. */
  listBranches: (dir: string) => Promise<BranchInfo[]>
  /** Switches HEAD to `branch` (the selected branch sync operates on). */
  checkoutBranch: (dir: string, branch: string) => Promise<GitResult>
  /** Clones `url` into `dir` (used to set up tab storage on mobile). */
  cloneRepo: (url: string, dir: string) => Promise<GitResult>
  /** Stores (or clears, when empty) the HTTPS Personal Access Token. */
  setToken: (token: string) => Promise<void>
  /** Whether a PAT is currently stored. */
  hasToken: () => Promise<boolean>
  /** Whether sync has usable auth: a stored PAT or the opted-in OS credential helper. */
  isAuthenticated: () => Promise<boolean>
  /** Whether the user has opted into the OS git credential helper. */
  systemCredentialsEnabled: () => Promise<boolean>
  /**
   * Desktop one-click sign-in: verifies the OS git credential helper can
   * authenticate against `origin` (triggering GCM's interactive login if needed)
   * and, on success, records that auth is configured. Not available on mobile.
   */
  useSystemCredentials: (dir: string) => Promise<GitResult>
  /** Turns off the system-credential opt-in (leaves any stored PAT untouched). */
  disableSystemCredentials: () => Promise<void>
}

/** Rust `SyncResult` (snake_case) → TS `SyncResult` (camelCase). */
type RawSyncResult = {
  success: boolean
  committed: boolean
  pulled: number
  pushed: number
  conflicts_resolved: number
  branch?: string
  up_to_date: boolean
  changed: boolean
  message: string
  error?: string
  error_kind?: SyncErrorKind
}

type RawBranchInfo = { name: string; is_head: boolean; is_remote: boolean; upstream?: string }

/** Rust `SyncResult` (snake_case) → TS `SyncResult` (camelCase). Shared by both backends. */
const toSyncResult = (r: RawSyncResult): SyncResult => ({
  success: r.success,
  committed: r.committed,
  pulled: r.pulled,
  pushed: r.pushed,
  conflictsResolved: r.conflicts_resolved,
  branch: r.branch,
  upToDate: r.up_to_date,
  changed: r.changed,
  message: r.message,
  error: r.error,
  errorKind: r.error_kind,
})

/** Rust `BranchInfo` (snake_case) → TS `BranchInfo` (camelCase). Shared by both backends. */
const toBranchInfo = (b: RawBranchInfo): BranchInfo => ({
  name: b.name,
  isHead: b.is_head,
  isRemote: b.is_remote,
  upstream: b.upstream,
})

/**
 * Git operations backed by the in-app libgit2 engine (Rust commands), so sync
 * works identically on desktop and Android. Read-only queries degrade
 * gracefully; mutating operations return a `GitResult` carrying success/error.
 */
const createTauriGitService = async (): Promise<GitService> => ({
  async isGitRepo(dir) {
    try {
      return await invoke<boolean>('git_is_repo', { dir })
    } catch {
      return false
    }
  },
  async getChangedFiles(dir) {
    try {
      return await invoke<GitChangedFile[]>('git_status', { dir })
    } catch {
      return []
    }
  },
  pull: (dir) => invoke<GitResult>('git_pull', { dir }),
  commit: (dir, message) => invoke<GitResult>('git_commit', { dir, message }),
  push: (dir) => invoke<GitResult>('git_push', { dir }),
  async getUnpushedCommits(dir) {
    try {
      return await invoke<string[]>('git_unpushed', { dir })
    } catch {
      return []
    }
  },
  async sync(dir) {
    return toSyncResult(await invoke<RawSyncResult>('git_sync', { dir }))
  },
  async listBranches(dir) {
    try {
      return (await invoke<RawBranchInfo[]>('git_list_branches', { dir })).map(toBranchInfo)
    } catch {
      return []
    }
  },
  checkoutBranch: (dir, branch) => invoke<GitResult>('git_checkout_branch', { dir, branch }),
  cloneRepo: (url, dir) => invoke<GitResult>('git_clone', { url, dir }),
  setToken: (token) => invoke<void>('git_set_token', { token }),
  hasToken: () => invoke<boolean>('git_has_token'),
  async isAuthenticated() {
    try {
      return await invoke<boolean>('git_is_authenticated')
    } catch {
      return false
    }
  },
  async systemCredentialsEnabled() {
    try {
      return await invoke<boolean>('git_system_credentials_enabled')
    } catch {
      return false
    }
  },
  useSystemCredentials: (dir) => invoke<GitResult>('git_use_system_credentials', { dir }),
  disableSystemCredentials: () => invoke<void>('git_disable_system_credentials'),
})

const JSON_HEADERS = { 'Content-Type': 'application/json' }

// Git mutation endpoints never signal git failures via HTTP status — the outcome
// is carried inside the returned GitResult, exactly like the desktop commands.
const gitResult = async (path: string, body?: unknown): Promise<GitResult> => {
  const res = await fetch(path, {
    method: 'POST',
    headers: body ? JSON_HEADERS : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return (await res.json()) as GitResult
}

/** Reads a `{value}` boolean flag endpoint, degrading to `fallback` on any error. */
const readFlag = async (path: string, fallback: boolean): Promise<boolean> => {
  try {
    const res = await fetch(path)
    if (!res.ok) return fallback
    return ((await res.json()) as { value: boolean }).value
  } catch {
    return fallback
  }
}

/**
 * Git operations backed by the klank-server HTTP API. The repo is always the
 * server's tabs dir, so `dir` arguments are accepted for interface parity and
 * ignored. Read-only queries degrade gracefully; mutations carry success/error
 * inside their `GitResult`/`SyncResult`.
 */
const createHttpGitService = (): GitService => ({
  async isGitRepo() {
    return readFlag('/api/git/is-repo', false)
  },
  async getChangedFiles() {
    try {
      const res = await fetch('/api/git/status')
      if (!res.ok) return []
      return (await res.json()) as GitChangedFile[]
    } catch {
      return []
    }
  },
  pull: () => gitResult('/api/git/pull'),
  commit: (_dir, message) => gitResult('/api/git/commit', { message }),
  push: () => gitResult('/api/git/push'),
  async getUnpushedCommits() {
    try {
      const res = await fetch('/api/git/unpushed')
      if (!res.ok) return []
      return (await res.json()) as string[]
    } catch {
      return []
    }
  },
  async sync() {
    const res = await fetch('/api/git/sync', { method: 'POST' })
    return toSyncResult((await res.json()) as RawSyncResult)
  },
  async listBranches() {
    try {
      const res = await fetch('/api/git/branches')
      if (!res.ok) return []
      return ((await res.json()) as RawBranchInfo[]).map(toBranchInfo)
    } catch {
      return []
    }
  },
  checkoutBranch: (_dir, branch) => gitResult('/api/git/checkout', { branch }),
  cloneRepo: (url) => gitResult('/api/git/clone', { url }),
  async setToken(token) {
    await fetch('/api/git/token', {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify({ token }),
    })
  },
  hasToken: () => readFlag('/api/git/has-token', false),
  isAuthenticated: () => readFlag('/api/git/is-authenticated', false),
  systemCredentialsEnabled: () => readFlag('/api/git/system-credentials-enabled', false),
  useSystemCredentials: () => gitResult('/api/git/use-system-credentials'),
  async disableSystemCredentials() {
    await fetch('/api/git/disable-system-credentials', { method: 'POST' })
  },
})

export const createGitService = async (): Promise<GitService> =>
  isTauri() ? createTauriGitService() : createHttpGitService()
