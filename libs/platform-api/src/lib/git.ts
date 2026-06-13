import { invoke } from '@tauri-apps/api/core'

export type GitChangedFile = { status: string; path: string }
export type GitResult = { success: boolean; output: string; error?: string }

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
}

type RawBranchInfo = { name: string; is_head: boolean; is_remote: boolean; upstream?: string }

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
    const r = await invoke<RawSyncResult>('git_sync', { dir })
    return {
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
    }
  },
  async listBranches(dir) {
    try {
      const raw = await invoke<RawBranchInfo[]>('git_list_branches', { dir })
      return raw.map((b) => ({
        name: b.name,
        isHead: b.is_head,
        isRemote: b.is_remote,
        upstream: b.upstream,
      }))
    } catch {
      return []
    }
  },
  checkoutBranch: (dir, branch) => invoke<GitResult>('git_checkout_branch', { dir, branch }),
  cloneRepo: (url, dir) => invoke<GitResult>('git_clone', { url, dir }),
  setToken: (token) => invoke<void>('git_set_token', { token }),
  hasToken: () => invoke<boolean>('git_has_token'),
})

export const createGitService = async (): Promise<GitService> => createTauriGitService()
