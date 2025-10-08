"use client"
import React, {useEffect, useState} from "react";
import {
  BaseDirectory,
  create,
  DirEntry,
  exists,
  readDir,
  readTextFile,
  remove,
  writeTextFile
} from "@tauri-apps/plugin-fs";
import {appLocalDataDir, join} from '@tauri-apps/api/path';
import Sheet from "./Sheet";
import {open} from '@tauri-apps/plugin-dialog';
import styled from "styled-components";
import Button from "./Button";
import {fetch} from "@tauri-apps/plugin-http";
import path from "path";
import useKlankStore from "web/state/store";
import TabDetails from "./TabDetails";
import ScrollContainer from "./ScrollContainer";
import Toolbar from "./Toolbar";
import Menu from "./Menu";
import { confirm } from '@tauri-apps/plugin-dialog';


const ApplicationWrapper = styled.main.attrs<{ $isMenuExtended: boolean; $menuWidth: number }>(props => ({
  style: {
    gridTemplateColumns: `${props.$menuWidth}px 1fr`,
    '--menu-width': `${props.$menuWidth - 3}px`,
    background: props.theme.background,
    '--cursor-ew-resize': `${props.$isMenuExtended ? 'ew-resize' : 'default'}`
  }
}))<{ $isMenuExtended: boolean; $menuWidth: number }>`
  display: grid;
  transition: 100ms;
  overflow: hidden;
  width: 100%;
  height: 100vh;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--menu-width);
    cursor: var(--cursor-ew-resize);
    width: 6px;
    z-index: 1;
  }
`

const Textarea = styled.textarea<{ $mode: string }>`
    width: 100%;
    height: calc(100vh - 100px); // menu 100px padding 16px margin 32px bottom padding 16px
    color: ${props => props.theme.textColor};
    padding: 16px;
`

const ButtonContainer = styled.div`
    display: flex;
    gap: 4px;
    font-weight: bold;
`

const SaveButtonContainer = styled.li`
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  button {
    align-self: center;
    flex-basis: content;
  }
  > button:last-of-type {
    margin-left: auto;
  }
`

const EditButtonContainer = styled.li`
    width: 150px;
    height: 100%;
    display: flex;
    align-self: flex-end;

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
    <Button label={currentValue} disabled/>
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
  const [saveState, setSaveState] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string>()
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isMenuExtended, setIsMenuExtended] = useState<boolean>(true)
  const [menuWidth, setMenuWidth] = useState(250)
  const [isRefreshTriggered, setIsRefreshTriggered] = useState(false)
  const isScrolling = useKlankStore().tab.isScrolling
  const setIsScrolling = useKlankStore().setTabIsScrolling
  const setCurrentTabPath = useKlankStore().setTabPath
  const currentTabPath = useKlankStore().tab.path
  const setScrollSpeed = useKlankStore().setTabScrollSpeed
  const scrollSpeed = useKlankStore().tab.scrollSpeed
  const setTranspose = useKlankStore().setTabTranspose
  const transpose = useKlankStore().tab.transpose
  const setFontSize = useKlankStore().setTabFontSize
  const fontSize = useKlankStore().tab.fontSize
  const mode = useKlankStore().mode
  const setMode = useKlankStore().setMode
  const setDetails = useKlankStore().setTabDetails
  const details = useKlankStore().tab.details
  const youtubeLink = useKlankStore().tab.link
  const setYoutubeLink = useKlankStore().setTabLink
  const tabSettingByPath = useKlankStore().tabSettingByPath
  const setTabSettingByPath = useKlankStore().setTabSettingByPath
  const setTabSettings = useKlankStore().setTabSettings

  const handleMouseDown = (event: React.MouseEvent) => {
    const startX = event.clientX
    const startWidth = menuWidth
    let animationFrame: number | null = null

    const onMouseMove = (e: MouseEvent) => {
      if (animationFrame) return
      animationFrame = requestAnimationFrame(() => {
        const newWidth = Math.max(64, startWidth + (e.clientX - startX)) // Minimum width is 64px
        setMenuWidth(newWidth)
        animationFrame = null
      })
    }

    const onMouseUp = () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const handleTransposeChange = (value: number): void => {
    setTranspose(transpose + value)
  }

  const handleScrollSpeedChange = (value: number): void => {
    setScrollSpeed(scrollSpeed + value)
  }

  const doMe = async () => {
    const url = window.prompt("From what URL should we import?")
    if (url === undefined || url === null || url === "")
      return

    const result = await fetch(url)
    const htmlData = await result.text()
    const parser = new DOMParser()
    const htmlDoc = parser.parseFromString(htmlData, 'text/html')

    const json = JSON.parse(htmlDoc.getElementsByClassName('js-store')[0]?.getAttribute('data-content') ?? "{}")
    const data = json.store.page.data.tab_view.wiki_tab.content.toString().replace(/(\[(ch|tab)\]|\[(\/)?(ch|tab)\])/g, '')

    const artist = json.store.page.data.tab.artist_name ?? ""
    const title = json.store.page.data.tab.song_name ?? ""


    const filename = `${artist} - ${title}.tab.txt`

    setCurrentTabPath(path.join(baseDirectory ?? "", filename))
    setIsRefreshTriggered(true)
    setTranspose(0)
    setScrollSpeed(1)

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
    await writeTextFile(currentTabPath, editedTab).catch(exception => setSaveError("Couldn't save the file!"))
    setSheetData(editedTab)
  }

  const removeTab = async () => {
    await remove(currentTabPath)
        .then(() => {
          setMode('Read')

          const findAnyFile = (items: FileTree = []): string | undefined => {
            const foundItem = items.find(item =>
                "path" in item && item.isFile && item.path !== currentTabPath
            )
            if (foundItem && "path" in foundItem) {
              return foundItem.path
            }
            return undefined
          }

          const nextPath = findAnyFile(tree)
          if (nextPath) {
            setCurrentTabPath(nextPath)
          } else {
            setCurrentTabPath('')
          }

          setSheetData('')
          setIsRefreshTriggered(true)
        })
  }

  const handleFontChange = (value: number) => {
    setFontSize(fontSize + value)
  }

  useEffect(() => {
    if (baseDirectory === undefined || baseDirectory === null) {
      appLocalDataDir().then(folder => {
        setBaseDirectory(folder)
      })
    }
  }, [baseDirectory])

  useEffect(() => {
    (async () => {
      const klankRcFilePath = path.join(baseDirectory ?? '', '.klankrc.json')
      if (await exists(klankRcFilePath)) {
        try {
          const config = JSON.parse(await readTextFile(klankRcFilePath))
          setTabSettings(config)
        } catch (exception) {
          console.log("Could not load .klankrc.json!")
        }
      } else {
        const file = await create(klankRcFilePath)
        await file.write(new TextEncoder().encode('{}'))
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
          setYoutubeLink(tabSettingByPath[currentTabPath].link ?? '')

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
    if (baseDirectory && currentTabPath) {
      (async () => {
        if (currentTabPath.trim() === '') return
        
        const normalizedPath = path.normalize(currentTabPath)
        
        const newTabSetting = {
          fontSize,
          path: normalizedPath,
          transpose,
          isScrolling: false,
          details,
          link: youtubeLink,
          scrollSpeed
        }
        setTabSettingByPath(normalizedPath, newTabSetting)

        const cleanSettings = Object.fromEntries(
          Object.entries(tabSettingByPath).filter(([key]) => key.trim() !== '')
        )

        const klankRcFilePath = path.join(baseDirectory, '.klankrc.json')
        const file = await create(klankRcFilePath)
        await file.write(new TextEncoder().encode(JSON.stringify(cleanSettings, null, 2)))
        await file.close();
      })()
    }
  }, [fontSize, scrollSpeed, transpose, details, youtubeLink])

  useEffect(() => {
    (async () => {
      if (baseDirectory && await exists(baseDirectory)) {
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

  useEffect(() => {
    if (isMenuExtended) {
      setMenuWidth(400)
    } else {
      setMenuWidth(64)
    }
  }, [isMenuExtended])

  return <ApplicationWrapper
    $isMenuExtended={isMenuExtended}
    $menuWidth={menuWidth}
    onMouseDown={(e) => {
      const rect = e.currentTarget.getBoundingClientRect()
      if (isMenuExtended && e.clientX >= rect.left + menuWidth - 3 && e.clientX <= rect.left + menuWidth + 3) {
        e.preventDefault()
        handleMouseDown(e)
      }
    }}
    {...props}
  >
    <Menu
      baseDirectory={baseDirectory ?? ''}
      tree={tree}
      isLoading={isLoading}
      setSheetData={setSheetData}
      handleFolderPathUpdate={handleFolderPathUpdate}
      currentTabPath={currentTabPath}
      doMe={doMe}
      setIsMenuExtended={setIsMenuExtended}
      isMenuExtended={isMenuExtended}
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
          <EditButtonContainer key='edit'>
            <Button label='Edit' onClick={() => setMode('Edit')}/>
          </EditButtonContainer>
        </>}
        {mode === "Edit" && <SaveButtonContainer>
          <Button label='Close' onClick={() => setMode('Read')}/>
          <Button label='Save' onClick={async () => {
            setSaveState('Saving')
            await saveEditedTab()
              .then(() => {
                setSaveState('Saved')
                setTimeout(() => {
                  setSaveState(null)
                }, 1000)
              })
          }}/>
          {saveState !== null && <span>{saveState}</span>}
          {saveError && <span>Error!</span>}
          <Button label='delete' onClick={async () => {
            await confirm(
                'This action cannot be reverted. Are you sure?',
                { title: 'Klank', kind: 'warning' })
                .then(result =>
                    result
                        ? removeTab().catch(exception => setSaveError("Couldn't delete the file!"))
                        : null
                )

          }}/>
        </SaveButtonContainer>}
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