"use client"
import React, {useEffect, useState} from "react";
import {BaseDirectory, DirEntry, readDir, readTextFile, create} from "@tauri-apps/plugin-fs";
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
import RefreshIcon from "./icons/RefreshIcon";
import {fetch} from "@tauri-apps/plugin-http";
import path from "node:path";

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
const MenuItem = styled.li<{ $isSelected?: boolean }>`
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
    overflow: hidden;
    background: ${props => props.$isSelected ? '#e3e3e3' : 'none'};
    border-radius: 4px;
    padding: 2px;
`

const MenuButton = styled.button`
    display: flex;
    width: 100%;
    cursor: pointer;
    align-items: center;

    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    svg {
        flex-shrink: 0;
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
  const [isRefreshTriggered, setIsRefreshTriggered] = useState(false)
  const [userConfig, setUserConfig] = useState<Store>()

  const doMe = async () => {
    const url = window.prompt("From what URL should we import?")
    console.log(url)
    if (url === undefined || url === null || url === "")
      return
    // 'https://tabs.ultimate-guitar.com/tab/print?flats=0&font_size=1&id=3860363&is_ukulele=0&simplified=0&transpose=0
    const result = await fetch(url)
    console.log(result)
    const htmlData = await result.text()
    const parser = new DOMParser();
    const htmlDoc = parser.parseFromString(htmlData, 'text/html');
    const json = JSON.parse(htmlDoc.getElementsByClassName('js-store')[0]?.getAttribute('data-content') ?? "{}")
    console.log(json)
    const data = json.store.page.data.tab_view.wiki_tab.content.toString().replace(/(\[(ch|tab)\]|\[(\/)?(ch|tab)\])/g, ''))

    const artist = json.store.page.data.tab_view.versions.find(version => version.artist_name !== null && version.artist_name !== undefined).artist_name
    const title = json.store.page.data.tab_view.versions.find(version => version.song_name !== null && version.song_name !== undefined).song_name
    console.log("artist", artist)
    console.log("title", title)
    const filename = `${artist} - ${title}.tab.txt`
    console.log("filename", filename)

    const file = await create(path.join(baseDirectory ?? "", filename));
    await file.write(new TextEncoder().encode(data));
    await file.close();

    return data
  }

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
          setIsRefreshTriggered(false)
        })
    }
  }, [baseDirectory, isRefreshTriggered])

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
        <Button iconButton={true} icon={<RefreshIcon/>} disabled={isLoading}
                onClick={() => setIsRefreshTriggered(true)}/>
      </MenuItem>
      <MenuItem>
        <MenuButton>
          <span onClick={async () => setSheetData(await doMe() ?? "")}>
            Click me
          </span>
        </MenuButton>
      </MenuItem>
      {
        isLoading ? <li className='loading'><LoadingIcon/></li> : tree?.map(createTreeStructure)
      }
    </MenuWrapper>
    <Sheet data={sheetData ?? ""}/>
  </ApplicationWrapper>
}


export default Application;
