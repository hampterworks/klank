export type GitChangedFile = { status: string; path: string }
export type GitResult = { success: boolean; output: string; error?: string }

export type GitService = {
  isGitRepo: (dir: string) => Promise<boolean>
  getChangedFiles: (dir: string) => Promise<GitChangedFile[]>
  pull: (dir: string) => Promise<GitResult>
  commit: (dir: string, message: string) => Promise<GitResult>
  push: (dir: string) => Promise<GitResult>
  getUnpushedCommits: (dir: string) => Promise<string[]>
}

const createTauriGitService = async (): Promise<GitService> => {
  const { Command } = await import('@tauri-apps/plugin-shell')

  const run = async (dir: string, args: string[]) => {
    const output = await Command.create('git', args, { cwd: dir }).execute()
    return { stdout: output.stdout, stderr: output.stderr, code: output.code }
  }

  return {
    async isGitRepo(dir) {
      try {
        return (await run(dir, ['rev-parse', '--is-inside-work-tree'])).code === 0
      } catch {
        return false
      }
    },

    async getChangedFiles(dir) {
      try {
        const { stdout, code } = await run(dir, ['status', '--porcelain'])
        if (code !== 0) return []
        return stdout
          .trim()
          .split('\n')
          .filter(Boolean)
          .map((line) => ({ status: line.slice(0, 2).trim(), path: line.slice(3).trim() }))
      } catch {
        return []
      }
    },

    async pull(dir) {
      try {
        await run(dir, ['fetch'])
        const { stdout, stderr, code } = await run(dir, ['pull', '--rebase'])
        return { success: code === 0, output: stdout || stderr }
      } catch (e) {
        return { success: false, output: '', error: String(e) }
      }
    },

    async commit(dir, message) {
      try {
        await run(dir, ['add', '-A'])
        const { stdout, stderr, code } = await run(dir, ['commit', '-m', message])
        return { success: code === 0, output: stdout || stderr }
      } catch (e) {
        return { success: false, output: '', error: String(e) }
      }
    },

    async push(dir) {
      try {
        const { stdout, stderr, code } = await run(dir, ['push'])
        return { success: code === 0, output: stdout || stderr }
      } catch (e) {
        return { success: false, output: '', error: String(e) }
      }
    },

    async getUnpushedCommits(dir) {
      try {
        const { stdout, code } = await run(dir, ['log', '--oneline', '@{u}..HEAD'])
        return code === 0 ? stdout.trim().split('\n').filter(Boolean) : []
      } catch {
        return []
      }
    },
  }
}

export const createGitService = async (): Promise<GitService> => createTauriGitService()
