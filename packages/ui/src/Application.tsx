"use client"
import React, {useEffect, useState} from "react";
import {BaseDirectory, DirEntry, readDir, readTextFile} from "@tauri-apps/plugin-fs";
import {appLocalDataDir, join} from '@tauri-apps/api/path';
import Sheet from "./Sheet";
import {open} from '@tauri-apps/plugin-dialog';
import {load, Store} from '@tauri-apps/plugin-store';

import styled from "styled-components";
import Button from "./Button";
import FolderIcon from "./icons/FolderIcon";
import FileIcon from "./icons/FileIcon";
import ToolTip from "./ToolTip";

const ApplicationWrapper = styled.main`
    display: grid;
    grid-template-columns: 250px 1fr;
    overflow: hidden;
    width: 100%;

    > ul {
        height: 100vh;
        border-right: 1px solid black;
        padding: 8px;
        overflow-y: auto;
        font-size: 14px;

        li {
            gap: 4px;
            margin-bottom: 6px;
            overflow: hidden;

            ul {
                margin-left: 16px;
            }

            button {
                display: flex;
                width: 100%;
                cursor: pointer;
                align-items: center;
                gap: 4px;

                span {
                    text-overflow: ellipsis;
                    overflow: hidden;
                    white-space: nowrap;
                    max-width: 100%;
                }

                svg {
                    width: 24px;
                }
            }
        }
    }
`

type RecursiveDirEntry = {
  name: string
  isDirectory: false
  isFile: boolean
  isSymlink: boolean
  path: string
} | {
  name: string
  isDirectory: true
  isFile: false
  isSymlink: false
  path: string
  children: RecursiveDirEntry[]
}

type File = RecursiveDirEntry | DirEntry

type FileTree = File[]

const processEntriesRecursively = async (parent: string, entries: FileTree, filter: (name: File) => boolean): Promise<FileTree> => {
  return Promise.all(entries.filter(file => filter(file)).flatMap(async entry => {
    const dir = await join(parent, entry.name);
    if (entry.isDirectory) {
      // console.log(entry)
      return {
        ...entry,
        path: dir,
        children: await processEntriesRecursively(dir, await readDir(dir, {baseDir: BaseDirectory.AppLocalData}), filter)
      }
    }
    return {
      ...entry,
      path: dir,
    }
  }))
}

const readDirectoryRecursively = async (dir: string, filter: (name: File) => boolean) => {
  const entries = await readDir(dir);
  return await processEntriesRecursively(dir, entries, filter)
}

const Application: React.FC<React.ComponentPropsWithoutRef<'main'>> = ({...props}) => {
  const [baseDirectory, setBaseDirectory] = useState<string>()
  const [tree, setTree] = useState<FileTree>()
  const [selectedFilePath, setSelectedFilePath] = useState<string>()
  const [sheetData, setSheetData] = useState<string>()
  const [userConfig, setUserConfig] = useState<Store>()

  useEffect(() => {
    const initStore = async () => {
      const store = await load('store.json', {autoSave: false})

      store.get<{ lastPath: string }>('last-path')
        .then(data => {
          if (data !== undefined)
            setSelectedFilePath(data?.lastPath)
        })

      store.get<{ lastFolder: string }>('last-folder')
        .then(data => {
          if (data !== undefined) {
            setBaseDirectory(data?.lastFolder)
          } else {
            appLocalDataDir().then(setBaseDirectory)
          }
        })
      setUserConfig(store)
    }
    initStore()

  }, [])

  useEffect(() => {
    if (selectedFilePath !== undefined) {
      readTextFile(selectedFilePath).then(setSheetData)
    }
  }, [selectedFilePath])

  const handleFilePathUpdate = (path: string) => {
    userConfig?.set('last-path', {lastPath: path})
    readTextFile(path).then(setSheetData)
  }

  const handleFolderPathUpdate = async () => {
    const path = await open({
      multiple: false,
      directory: true,
    })

    if (path) {
      setBaseDirectory(path)
      userConfig?.set('last-folder', {lastFolder: path})
    }
  }

  useEffect(() => {
    if (baseDirectory !== undefined)
      readDirectoryRecursively(baseDirectory, file => file.isDirectory || file.name.endsWith(".tab.txt")).then(setTree)
  }, [baseDirectory])

  const createTreeStructure = (file: DirEntry | RecursiveDirEntry) => {
    if ("path" in file) {
      if (file.isDirectory && file.children.length !== 0 && file.children.find(item => item.isFile)) {
        return <li key={file.path}>
          <button>
            <FolderIcon/>
            <span>{file.name}</span>
          </button>
          <ul>{file.children && file.children.map(child => createTreeStructure(child))}</ul>
        </li>
      } else if (file.isFile) {
        return <li key={file.path}>
          <button>
            <FileIcon/>
            <span onClick={() => handleFilePathUpdate(file.path)}>
              <ToolTip message={file.name}>
                {file.name}
              </ToolTip>
            </span>
          </button>
        </li>
      }
    }
  }

  return <ApplicationWrapper {...props}>
    <ul>
      <li>
        <Button label='Change Folder' onClick={() => handleFolderPathUpdate()}/>
      </li>
      {tree?.map(createTreeStructure)}
    </ul>
    <Sheet data={sheetData ?? ""}/>
  </ApplicationWrapper>
}


export default Application;
