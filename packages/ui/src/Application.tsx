"use client"
import React, {useEffect, useState} from "react";
import {BaseDirectory, DirEntry, readDir, readTextFile, create, writeTextFile, exists} from "@tauri-apps/plugin-fs";
import {appLocalDataDir, join} from '@tauri-apps/api/path';
import Sheet from "./Sheet";
import {open} from '@tauri-apps/plugin-dialog';

import styled from "styled-components";
import Button from "./Button";
import FolderIcon from "./icons/FolderIcon";
import FileIcon from "./icons/FileIcon";
import ToolTip from "./ToolTip";
import LoadingIcon from "./icons/LoadingIcon";
import RefreshIcon from "./icons/RefreshIcon";
import {fetch} from "@tauri-apps/plugin-http";
import path from "node:path";
import useKlankStore from "web/state/store";
import TabDetails from "./TabDetails";
import ScrollContainer from "./ScrollContainer";
import Toolbar from "./Toolbar";
import Menu from "./Menu";

const ApplicationWrapper = styled.main`
    display: grid;
    grid-template-columns: 250px 1fr;
    overflow: hidden;
    width: 100%;

    background: ${props => props.theme.background};
    
    .loading {
        display: block;
        align-self: center;
        margin-top: 16px;
    }
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

const Textarea = styled.textarea<{$mode: string}>`
    width: 100%;
    height: calc(100vh - 100px); // menu 100px padding 16px margin 32px bottom padding 16px
    color: ${props => props.theme.textColor};
`

const ButtonContainer = styled.div`
    display: flex;
    gap: 4px;
    font-weight: bold;
`

type ButtonProps = {
  currentValue: number
  onIncrement: (value: number) => void;
}

const IncrementDecrementButtons: React.FC<ButtonProps> = ({onIncrement, currentValue}) => {
  return <ButtonContainer>
    <Button label='-1' onClick={() => {
      onIncrement(-1)
    }}/>
    <Button label={currentValue} disabled />
    <Button label='+1' onClick={() => {
      onIncrement(1)
    }}/>
  </ButtonContainer>
}

export type RecursiveDirEntry = {
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

export type FileTree = File[]

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
  const baseDirectory = useKlankStore().baseDirectory
  const setBaseDirectory = useKlankStore().setBaseDirectory
  const [tree, setTree] = useState<FileTree>()
  const [sheetData, setSheetData] = useState<string>("")
  const [editedTab, setEditedTab] = useState<string>(sheetData)
  const [saveError, setSaveError] = useState<string>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isRefreshTriggered, setIsRefreshTriggered] = useState(false)
  const isScrolling = useKlankStore().tab.isScrolling
  const setIsScrolling = useKlankStore().setTabIsScrolling
  const currentTabPath = useKlankStore().tab.path
  const setScrollSpeed = useKlankStore().setTabScrollSpeed
  const scrollSpeed = useKlankStore().tab.scrollSpeed
  const setTranspose = useKlankStore().setTabTranspose
  const transpose = useKlankStore().tab.transpose
  const setFontSize = useKlankStore().setTabFontSize
  const fontSize = useKlankStore().tab.fontSize
  const mode = useKlankStore().mode
  const setDetails = useKlankStore().setTabDetails
  const details = useKlankStore().tab.details
  const tabSettingByPath = useKlankStore().tabSettingByPath
  const setTabSettingByPath = useKlankStore().setTabSettingByPath
  const setTabSettings = useKlankStore().setTabSettings

  const handleTransposeChange = (value: number): void => {
    setTranspose(transpose + value)
  }

  const handleScrollSpeedChange = (value: number): void => {
    setScrollSpeed(scrollSpeed + value)
  }

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


  const handleFolderPathUpdate = async () => {
    const path = await open({
      multiple: false,
      directory: true,
    })

    if (path) {
      setBaseDirectory(path)
    }
  }

  const saveEditedTab = async () => {
    await (writeTextFile(currentTabPath, editedTab).catch(exception => setSaveError("Couldn't save the file!")));
    setSheetData(editedTab)
  }

  const handleFontChange = (value: number) => {
      setFontSize(fontSize + value)
  }

  useEffect(() => {
    (async () => {
      const klankRcFilePath = path.join(baseDirectory, '.klankrc.json')
      if (await exists(klankRcFilePath)) {
        try {
          const config = JSON.parse(await readTextFile(klankRcFilePath))
          setTabSettings(config)
        }
        catch (exception) {
          console.log("Could not load .klankrc.json!")
        }
      }
      else {
        const file = await create(klankRcFilePath);
        await file.write(new TextEncoder().encode('{}'));
        await file.close();
      }
    })()
  }, [baseDirectory])

  useEffect(() => {
    (async () => {
      if (await exists(currentTabPath)) {
        const newSheetData = await readTextFile(currentTabPath)
        setSheetData(newSheetData)
        setEditedTab(newSheetData)
        if (tabSettingByPath[currentTabPath] !== undefined) {
          setTranspose(tabSettingByPath[currentTabPath].transpose)
          setScrollSpeed(tabSettingByPath[currentTabPath].scrollSpeed)
          setFontSize(tabSettingByPath[currentTabPath].fontSize)
          setDetails(tabSettingByPath[currentTabPath].details)
        } else {
          setTabSettingByPath(currentTabPath, {
            fontSize,
            path: currentTabPath,
            transpose,
            isScrolling: false,
            details: "",
            scrollSpeed
          })
        }
      }
    })()
  }, [currentTabPath, readTextFile])

  useEffect(() => {
    (async () => {
      const newTabSetting = {
        fontSize,
        path: currentTabPath,
        transpose,
        isScrolling: false,
        details,
        scrollSpeed
      }
      setTabSettingByPath(currentTabPath, newTabSetting)

      const klankRcFilePath = path.join(baseDirectory, '.klankrc.json')
      const file = await create(klankRcFilePath);
      await file.write(new TextEncoder().encode(JSON.stringify(tabSettingByPath, null, 2)));
      await file.close();
    })()
  }, [fontSize, scrollSpeed, transpose, details])

  useEffect(() => {
    (async () => {
      if (await exists(baseDirectory)) {
        setIsLoading(true)
        readDirectoryRecursively(baseDirectory, file => file.isDirectory || file.name.endsWith(".tab.txt"))
          .then(tree => {
            setTree(tree)
            setIsLoading(false)
            setIsRefreshTriggered(false)
          })
      }
    })()
  }, [baseDirectory, isRefreshTriggered])

  return <ApplicationWrapper {...props}>
    <Menu
        baseDirectory={baseDirectory}
        tree={tree}
        isLoading={isLoading}
        setSheetData={setSheetData}
        setIsRefreshTriggered={setIsRefreshTriggered}
        handleFolderPathUpdate={handleFolderPathUpdate}
        currentTabPath={currentTabPath}
        doMe={doMe}
    />
    <ScrollContainer>
      <TabDetails/>
      <Toolbar>
        {mode === "Read" && <>
          <li key='fontControl'>
            <span>Size</span>
            <IncrementDecrementButtons onIncrement={handleFontChange} currentValue={fontSize}/>
          </li>
          <li key='transposeControl'>
            <span>Transpose</span>
            <IncrementDecrementButtons onIncrement={handleTransposeChange} currentValue={transpose}/>
          </li>
          <li key='autoscroll'>
            <span>Autoscroll</span>
            <div>
              <Button label={isScrolling ? 'Stop' : 'Start'} onClick={() => {
                setIsScrolling(!isScrolling)
              }}/>
              <IncrementDecrementButtons onIncrement={handleScrollSpeedChange} currentValue={scrollSpeed}/>
            </div>
          </li>
        </>}
        {mode === "Edit" && <li>
          <span>Save</span>
          {saveError && <span>Error!</span>}
          <Button label='Update' onClick={async () => await saveEditedTab()}/>
        </li>}
      </Toolbar>
      {mode === "Read" &&
      <Sheet data={sheetData ?? ""}/>}
      {mode === "Edit" &&
        <Textarea $mode={mode} id="tab-edit-textarea" defaultValue={sheetData}
                  onChange={event => setEditedTab(event.target.value)}/>
      }
    </ScrollContainer>
  </ApplicationWrapper>
}


export default Application;
