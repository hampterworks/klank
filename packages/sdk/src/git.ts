import { Command } from '@tauri-apps/plugin-shell'
import { exists } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'

export interface GitStatus {
  isClean: boolean
  status: string
  changes: {
    staged: string[]
    unstaged: string[]
    untracked: string[]
  }
}

export const checkGitFolder = async (directoryPath: string): Promise<boolean> => {
  try {
    const gitPath = await join(directoryPath, '.git')
    return await exists(gitPath)
  } catch (error) {
    console.error('Error checking for .git folder:', error)
    return false
  }
}

export const checkGitCleanState = async (directoryPath: string): Promise<{isClean: boolean; status?: string}> => {
  try {
    const isGitRepo = await checkGitFolder(directoryPath)
    if (!isGitRepo) {
      return { isClean: false, status: 'Not a git repository' }
    }

    const output = await Command.create('git', ['status', '--porcelain'], {
      cwd: directoryPath
    }).execute()

    if (output.code !== 0) {
      return { isClean: false, status: 'Failed to get git status' }
    }

    return { 
      isClean: output.stdout.trim() === '',
      status: output.stdout.trim() === '' ? 'Clean' : 'Has changes'
    }
  } catch (error) {
    console.error('Error checking git clean state:', error)
    return { isClean: false, status: 'Error checking git status' }
  }
}

export interface GitPullResult {
  success: boolean
  status: string
  details?: string
  hasConflicts?: boolean
}

export const pullChanges = async (directoryPath: string): Promise<GitPullResult> => {
  try {
    const fetchResult = await Command.create('git', ['fetch'], {
      cwd: directoryPath
    }).execute()

    if (fetchResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to fetch changes',
        details: fetchResult.stderr
      }
    }

    const pullResult = await Command.create('git', ['pull', '--rebase'], {
      cwd: directoryPath
    }).execute()

    if (pullResult.code !== 0) {
      const hasConflicts = pullResult.stderr.includes('CONFLICT') ||
          pullResult.stderr.includes('Automatic merge failed') ||
          pullResult.stderr.includes('Resolve all conflicts manually')

      return {
        success: false,
        status: hasConflicts ? 'Rebase conflicts detected' : 'Failed to pull changes',
        details: pullResult.stderr,
        hasConflicts
      }
    }

    const isUpToDate = !pullResult.stdout ||
        pullResult.stdout.includes('Already up to date') ||
        pullResult.stdout.includes('Already up-to-date') ||
        pullResult.stdout.includes('Current branch is up to date')

    return {
      success: true,
      status: isUpToDate ? 'Already up to date' : 'Successfully pulled changes',
      details: isUpToDate ? undefined : pullResult.stdout,
      hasConflicts: false
    }
  } catch (error) {
    console.error('Error pulling changes:', error)
    return {
      success: false,
      status: 'Error pulling changes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export interface GitCommitResult {
  success: boolean
  status: string
  details?: string
  commitHash?: string
  message: string
}

export const commitChanges = async (
  directoryPath: string, 
  additionalDetails?: string
): Promise<GitCommitResult> => {
  try {
    const addResult = await Command.create('git', ['add', '-A'], {
      cwd: directoryPath
    }).execute()

    if (addResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to stage changes',
        details: addResult.stderr,
        message: ''
      }
    }

    const statusResult = await Command.create('git', ['status', '--porcelain'], {
      cwd: directoryPath
    }).execute()

    if (!statusResult.stdout.trim()) {
      return {
        success: false,
        status: 'No changes to commit',
        message: ''
      }
    }

    const changedFiles = statusResult.stdout.trim().split('\n').length
    let message = `add new tabs (${changedFiles} ${changedFiles === 1 ? 'file' : 'files'})`
    if (additionalDetails) {
      message += `: ${additionalDetails}`
    }

    const commitResult = await Command.create('git', ['commit', '-m', message], {
      cwd: directoryPath
    }).execute()

    if (commitResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to commit changes',
        details: commitResult.stderr,
        message
      }
    }

    const hashResult = await Command.create('git', ['rev-parse', 'HEAD'], {
      cwd: directoryPath
    }).execute()

    return {
      success: true,
      status: 'Changes committed successfully',
      details: commitResult.stdout,
      commitHash: hashResult.code === 0 ? hashResult.stdout.trim() : undefined,
      message
    }
  } catch (error) {
    console.error('Error committing changes:', error)
    return {
      success: false,
      status: 'Error committing changes',
      details: error instanceof Error ? error.message : 'Unknown error',
      message: ''
    }
  }
}

export interface GitPushResult {
  success: boolean
  status: string
  details?: string
}

export const pushChanges = async (directoryPath: string): Promise<GitPushResult> => {
  try {
    const branchResult = await Command.create('git', ['branch', '--show-current'], {
      cwd: directoryPath
    }).execute()

    if (branchResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to get current branch',
        details: branchResult.stderr
      }
    }

    const currentBranch = branchResult.stdout.trim()

    const pushResult = await Command.create('git', ['push', 'origin', currentBranch], {
      cwd: directoryPath
    }).execute()

    if (pushResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to push changes',
        details: pushResult.stderr
      }
    }

    const isUpToDate = pushResult.stdout.includes('Everything up-to-date')

    return {
      success: true,
      status: isUpToDate ? 'Already up to date' : 'Successfully pushed changes',
      details: pushResult.stdout
    }
  } catch (error) {
    console.error('Error pushing changes:', error)
    return {
      success: false,
      status: 'Error pushing changes',
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
export interface GitUnpushedResult {
  success: boolean
  status: string
  hasUnpushedCommits: boolean
  commitCount?: number
  details?: string
}

export const checkUnpushedCommits = async (directoryPath: string): Promise<GitUnpushedResult> => {
  try {
    const fetchResult = await Command.create('git', ['fetch'], {
      cwd: directoryPath
    }).execute()

    if (fetchResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to fetch from remote',
        hasUnpushedCommits: false,
        details: fetchResult.stderr
      }
    }

    const branchResult = await Command.create('git', ['branch', '--show-current'], {
      cwd: directoryPath
    }).execute()

    if (branchResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to get current branch',
        hasUnpushedCommits: false,
        details: branchResult.stderr
      }
    }

    const currentBranch = branchResult.stdout.trim()

    const checkResult = await Command.create('git', 
      ['log', `origin/${currentBranch}..${currentBranch}`, '--oneline'], {
      cwd: directoryPath
    }).execute()

    if (checkResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to check unpushed commits',
        hasUnpushedCommits: false,
        details: checkResult.stderr
      }
    }

    const unpushedCommits = checkResult.stdout.trim()
    const commitCount = unpushedCommits ? unpushedCommits.split('\n').length : 0

    return {
      success: true,
      status: commitCount > 0 
        ? `Found ${commitCount} unpushed ${commitCount === 1 ? 'commit' : 'commits'}`
        : 'No unpushed commits',
      hasUnpushedCommits: commitCount > 0,
      commitCount,
      details: unpushedCommits || undefined
    }
  } catch (error) {
    console.error('Error checking unpushed commits:', error)
    return {
      success: false,
      status: 'Error checking unpushed commits',
      hasUnpushedCommits: false,
      details: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
export interface GitChanges {
  staged: string[];
  unstaged: string[];
  untracked: string[];
}

export const getChangedFiles = async (directoryPath: string): Promise<{
  success: boolean;
  status: string;
  changes?: GitChanges;
}> => {
  try {
    const statusResult = await Command.create('git', ['status', '--porcelain'], {
      cwd: directoryPath
    }).execute();

    if (statusResult.code !== 0) {
      return {
        success: false,
        status: 'Failed to get git status',
      };
    }

    const changes: GitChanges = {
      staged: [],
      unstaged: [],
      untracked: []
    };

    const lines = statusResult.stdout.trim().split('\n').filter(line => line);
    
    for (const line of lines) {
      const [status, ...fileParts] = line.trim().split(' ');
      const fileName = fileParts.join(' ');

      if (!status || !fileName) continue;

      // XX (where X is not a space) -> staged changes
      // X_ (where X is not a space) -> unstaged changes
      // ?? -> untracked files
      if (status === '??') {
        changes.untracked.push(fileName);
      } else if (status[0] !== ' ') {
        changes.staged.push(fileName);
      } else if (status[1] !== ' ') {
        changes.unstaged.push(fileName);
      }
    }

    return {
      success: true,
      status: lines.length ? 'Changes detected' : 'No changes',
      changes
    };
  } catch (error) {
    console.error('Error getting changed files:', error);
    return {
      success: false,
      status: 'Error getting changed files',
    };
  }
};