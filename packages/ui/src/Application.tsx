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
import LoadingIcon from "./icons/LoadingIcon";

const ApplicationWrapper = styled.main`
    display: grid;
    grid-template-columns: 250px 1fr;
    overflow: hidden;
    width: 100%;

    .loading {
        display: block;
        align-self: center;
        margin-top: 16px;
    }
`
const MenuWrapper = styled.ul`
    height: 100vh;
    border-right: 1px solid black;
    padding: 8px;
    overflow-y: auto;
    font-size: 14px;
    display: flex;
    flex-direction: column;

`
const MenuItem = styled.li<{ $isSelected?: boolean}>`
    gap: 4px;
    margin-bottom: 6px;
    overflow: hidden;
    background: ${props => props.$isSelected ? '#e3e3e3' : 'none'};
    border-radius: 4px;
    padding: 2px;


    ul {
        margin-left: 16px;
    }
`

const MenuButton = styled.button`
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
  const [isLoading, setIsLoading] = useState<boolean>(false)
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
    setSelectedFilePath(path)
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
    if (selectedFilePath !== undefined) {
      readTextFile(selectedFilePath).then(setSheetData)
    }
  }, [selectedFilePath, readTextFile])

  useEffect(() => {
    if (baseDirectory !== undefined) {
      setIsLoading(true)
      readDirectoryRecursively(baseDirectory, file => file.isDirectory || file.name.endsWith(".tab.txt"))
        .then(tree => {
          setTree(tree)
          setIsLoading(false)
        })
    }
  }, [baseDirectory])

  const createTreeStructure = (file: DirEntry | RecursiveDirEntry) => {
    if ("path" in file) {
      if (file.isDirectory && file.children.length !== 0 && file.children.find(item => item.isFile)) {
        return <MenuItem key={file.path}>
          <MenuButton>
            <FolderIcon/>
            <span>{file.name}</span>
          </MenuButton>
          <ul>{file.children && file.children.map(child => createTreeStructure(child))}</ul>
        </MenuItem>
      } else if (file.isFile) {
        return <MenuItem key={file.path} $isSelected={file.path === selectedFilePath}>
          <MenuButton>
            <FileIcon/>
            <span onClick={() => handleFilePathUpdate(file.path)}>
              <ToolTip message={file.name}>
                {file.name}
              </ToolTip>
            </span>
          </MenuButton>
        </MenuItem>
      }
    }
  }

  return <ApplicationWrapper {...props}>
    <MenuWrapper>
      <MenuItem>
        <ToolTip message={baseDirectory ?? ''}>
          {baseDirectory}
        </ToolTip>
      </MenuItem>
      <MenuItem>
        <Button label='Change Folder' disabled={isLoading} onClick={() => handleFolderPathUpdate()}/>
      </MenuItem>
      {
        isLoading ? <li className='loading'><LoadingIcon/></li> : tree?.map(createTreeStructure)
      }
    </MenuWrapper>
    <Sheet data={sheetData ?? ""}/>
  </ApplicationWrapper>
}


export default Application;
