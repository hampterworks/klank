import { invoke } from '@tauri-apps/api/core'

export type GitChangedFile = { status: string; path: string }
export type GitResult = { success: boolean; output: string; error?: string }

export type GitService = {
  isGitRepo: (dir: string) => Promise<boolean>
  getChangedFiles: (dir: string) => Promise<GitChangedFile[]>
  pull: (dir: string) => Promise<GitResult>
  commit: (dir: string, message: string) => Promise<GitResult>
  push: (dir: string) => Promise<GitResult>
  getUnpushedCommits: (dir: string) => Promise<string[]>
  /** Clones `url` into `dir` (used to set up tab storage on mobile). */
  cloneRepo: (url: string, dir: string) => Promise<GitResult>
  /** Stores (or clears, when empty) the HTTPS Personal Access Token. */
  setToken: (token: string) => Promise<void>
  /** Whether a PAT is currently stored. */
  hasToken: () => Promise<boolean>
}

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
  cloneRepo: (url, dir) => invoke<GitResult>('git_clone', { url, dir }),
  setToken: (token) => invoke<void>('git_set_token', { token }),
  hasToken: () => invoke<boolean>('git_has_token'),
})

export const createGitService = async (): Promise<GitService> => createTauriGitService()
