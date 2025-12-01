import { create, DirEntry } from '@tauri-apps/plugin-fs'
import path from 'path'

export type RecursiveDirEntry =
  | {
      name: string
      isDirectory: false
      isFile: boolean
      isSymlink: boolean
      path: string
    }
  | {
      name: string
      isDirectory: true
      isFile: false
      isSymlink: false
      path: string
      children: RecursiveDirEntry[]
    }

type File = RecursiveDirEntry | DirEntry

export type FileTree = File[]

export type FileEntry = {
  name: string
  path: string
  artist: string
  song?: string
}

export type FileService = {
  readDirectoryRecursively: (
    dir: string,
    filter: (name: File) => boolean
  ) => Promise<FileTree>
  readTabFile: (path: string) => Promise<string>
  getBaseDirectoryPath: () => Promise<string>
  writeTabFile: (
    filename: string,
    target: string,
    data: string
  ) => Promise<string>
}

export const mapTreeStructure = (
  files: (DirEntry | RecursiveDirEntry)[]
): FileEntry[] => {
  return files
    ?.flatMap((file: DirEntry | RecursiveDirEntry) => {
      if ('path' in file) {
        if (file.isDirectory && file.children.length !== 0) {
          return mapTreeStructure(file.children)
        } else if (file.isFile) {
          const fileName = file.name.replace(/\.tab\.txt$/, '')

          return {
            name: fileName,
            path: file.path,
            artist: fileName.split(' - ')[0],
            song: fileName.split(' - ')[1],
          }
        }
      }

      return undefined
    })
    .filter(Boolean) as FileEntry[]
}

// const createServerFileService = async (): Promise<FileService> => {
//   return {
//     getBaseDirectoryPath(): Promise<string> {
//       return Promise.resolve('')
//     },
//     readDirectoryRecursively(
//       dir: string,
//       filter: (name: File) => boolean
//     ): Promise<FileTree> {
//       return Promise.resolve(undefined)
//     },
//     readTabFile(path: string): Promise<string> {
//       return Promise.resolve('')
//     },
//     writeTabFile(path: string, data: string): Promise<void> {
//       return Promise.resolve(undefined)
//     },
//   }
// }

const createTauriFileService = async (): Promise<FileService> => {
  const { BaseDirectory, readDir, readTextFile } = await import(
    '@tauri-apps/plugin-fs'
  )
  const { appLocalDataDir, join } = await import('@tauri-apps/api/path')

  const processEntriesRecursively = async (
    parent: string,
    entries: FileTree,
    filter: (name: File) => boolean
  ): Promise<FileTree> => {
    return Promise.all(
      entries
        .filter((file) => filter(file))
        .flatMap(async (entry) => {
          const dir = await join(parent, entry.name)
          if (entry.isDirectory) {
            return {
              ...entry,
              path: dir,
              children: await processEntriesRecursively(
                dir,
                await readDir(dir, { baseDir: BaseDirectory.AppLocalData }),
                filter
              ),
            }
          }
          return {
            ...entry,
            path: dir,
          }
        })
    )
  }

  return {
    async writeTabFile(
      filename: string,
      target: string,
      data: string
    ): Promise<string> {
      try {
        const localPath = path.join(target ?? '', filename)
        const file = await create(localPath)
        await file.write(new TextEncoder().encode(data))
        await file.close()
        return localPath
      } catch (error) {
        return error instanceof Error ? error.message : 'Unknown error occurred'
      }
    },
    async readDirectoryRecursively(
      dir: string,
      filter: (name: File) => boolean
    ) {
      const entries = await readDir(dir)
      return await processEntriesRecursively(dir, entries, filter)
    },

    async readTabFile(path: string): Promise<string> {
      return await readTextFile(path)
    },

    async getBaseDirectoryPath(): Promise<string> {
      return await appLocalDataDir()
    },
  }
}

export const createFileService = async (
  mode: 'tauri' | 'server' = 'tauri'
): Promise<FileService> => {
  const serviceFactory = createTauriFileService
  const service = await serviceFactory()

  return {
    ...service,
  }
}
