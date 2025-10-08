'use client'

import * as React from "react";
import { flushSync } from 'react-dom';
import ToolTip from "./ToolTip";
import Button from "./Button";
import RefreshIcon from "./icons/RefreshIcon";
import LoadingIcon from "./icons/LoadingIcon";
import styled, {css} from "styled-components";
import {FileTree, RecursiveDirEntry} from "./Application";
import {DirEntry} from "@tauri-apps/plugin-fs";
import useKlankStore from "web/state/store";
import FolderIcon from "./icons/FolderIcon";
import FileIcon from "./icons/FileIcon";
import FolderOpenIcon from "./icons/FolderOpenIcon";
import DownloadIcon from "./icons/DownloadIcon";
import ThemeIcon from "./icons/ThemeIcon";
import LogoIcon from "./icons/LogoIcon";
import MenuToggleIcon from "./icons/MenuToggleIcon";
import SettingsIcon from "./icons/SettingsIcon";
import Link from "next/link";
import Input from "./Input";
import SearchIcon from "./icons/SearchIcon";
import {useEffect, useState} from "react";
import CloseIcon from "./icons/CloseIcon";
import QueueIcon from "./icons/QueueIcon";
import SongQueue from "./SongQueue";
import levenshteinDistance from "@repo/sdk/levenshteinDistance";
import getQueue from "@repo/sdk/getQueue";
import TargetIcon from "./icons/TargetIcon";
import ShuffleIcon from "./icons/ShuffleIcon";

const MenuWrapper = styled.ul<{ $isMenuExtended: boolean }>`
    display: flex;
    flex-direction: column;
    border-right: 1px solid ${props => props.theme.borderColor};
    overflow: hidden;
    font-size: 14px;
    color: ${props => props.theme.textColor};

    > li:first-of-type {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 24px;
        font-weight: 600;
        padding: ${props => props.$isMenuExtended ? '8px' : '6px 0'};
        ${props => !props.$isMenuExtended && 'flex-direction: column;'};

        > div {
            margin-left: auto;
        }

        svg {
            flex-shrink: 0;
        }
    }
`

const menuItemStyle = css<{ $isSelected?: boolean }>`
    overflow: hidden;
    background: ${props => props.$isSelected ? props.theme.selected : 'none'};
`

const MenuToolbarItem = styled.li<{ $isSelected?: boolean, $isMenuExtended: boolean }>`
    ${menuItemStyle};
    display: flex;
    align-items: center;
    
    ${props =>
            props.$isMenuExtended
                    ? css`justify-content: space-between;`
                    : css`
                        justify-content: center;
                        flex-direction: column;
                    `
    };

    border-top: 1px solid ${props => props.theme.borderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};
    padding: ${props => props.$isMenuExtended ? '8px' : '32px 0'};

`

const MenuDirectoryContentListItem = styled.ul`
    overflow-y: auto;
    border-bottom: 1px solid ${props => props.theme.borderColor};
    height: calc(100% - 180px);

    justify-content: flex-start;
`

const MenuDirectoryItem = styled.li<{ $isSelected?: boolean, $isMenuExtended: boolean }>`
    ${menuItemStyle};
    display: flex;
    align-items: center;
    padding: ${props => props.$isMenuExtended ? '8px' : '6px 0'};
    border-bottom: 1px solid ${props => props.theme.borderColor};
    justify-content: space-between;
    margin-left: ${props => props.$isMenuExtended ? '8px' : '6px'};
    div:first-of-type {
        display: flex;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
`

const MenuFolder = styled.li<{ $isSelected?: boolean, $isMenuExtended: boolean }>`
    display: flex;
    ${menuItemStyle};
    align-items: flex-start;
    flex-direction: column;
    margin-left: ${props => props.$isMenuExtended ? '0' : '4px'};
    cursor: none;

    > button {
        display: flex;
        align-items: center;
        white-space: nowrap;
        width: 100%;

        > div {
            margin-left: 8px;
        }
    }

`
const MenuItem = styled.li<{ $isSelected?: boolean, $isMenuExtended: boolean }>`
    display: flex;
    ${menuItemStyle};
    ${props => !props.$isMenuExtended && 'justify-content: center;'};
    margin: 8px;
`

const MenuButton = styled.button`
    > div {
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
    }

`

const Footer = styled.li<{ $isMenuExtended: boolean }>`
    padding: 8px 4px;
    margin-top: auto;
    display: flex;
    gap: 4px;
    justify-content: ${props => props.$isMenuExtended ? 'flex-end' : 'center'};
`
const LoadingIconContainer = styled.li`
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100%;
`
type SongWithDistance = { name: string, path: string, distance: number }

type MenuProps = {
  baseDirectory: string,
  tree?: FileTree
  isLoading: boolean
  setSheetData: (data: string) => void
  handleFolderPathUpdate: () => void
  currentTabPath: string
  doMe: () => Promise<string | undefined>
  isMenuExtended: boolean
  setIsMenuExtended: React.Dispatch<React.SetStateAction<boolean>>
} & React.ComponentPropsWithoutRef<'ul'>

const Menu: React.FC<MenuProps> = ({
                                     baseDirectory,
                                     tree,
                                     doMe,
                                     isMenuExtended,
                                     setIsMenuExtended,
                                     setSheetData,
                                     handleFolderPathUpdate,
                                     currentTabPath,
                                     isLoading,
                                     ...props
                                   }) => {
  const activeTheme = useKlankStore().theme
  const setActiveTheme = useKlankStore().setTheme
  const setMode = useKlankStore().setMode
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [songQueue, setSongQueue] = useState<any[]>()
  const [songList, setSongList] = useState<{ name: string, path: string }[]>([])

  const setCurrentTabPath = useKlankStore().setTabPath
  const streamerSongListUser = useKlankStore().streamerSongListUser
  const streamerSongListEnabled = useKlankStore().streamerSongListEnabled

  const handleFilePathUpdate = (path: string, callback?: () => void) => {
    flushSync(() => {
      setMode('Read')
      setCurrentTabPath(path)
    })
    
    // DOM is now updated, safe to call callback
    callback?.()
  }
  
  const handleQueuePathUpdate = (songName: string) => {
    setMode('Read')

    const result = songList.reduce<SongWithDistance>((acc, next) => {
      const distance = levenshteinDistance(next.name.toLowerCase(), songName.toLowerCase())
      if (distance < acc.distance) {
        return {...next, distance}
      }
      return acc
    }, {distance: Infinity, path: "", name: ""})

    if (result.path !== "" && result.distance < 5) {
      setCurrentTabPath(result.path)
    }
  }

  useEffect(() => {
    const mapTreeStructure = (files: (DirEntry | RecursiveDirEntry)[]): { name: string, path: string }[] => {
      return files?.flatMap((file: DirEntry | RecursiveDirEntry) => {
        if ("path" in file) {
          if (file.isDirectory && file.children.length !== 0) {
            return mapTreeStructure(file.children)
          } else if (file.isFile) {
            return {
              name: file.name.replace(/\.tab\.txt$/, ""),
              path: file.path
            }
          }
        }
      }).filter(Boolean) as { name: string, path: string }[] // Filter out undefined values from the map and assert the type
    }

    const result = mapTreeStructure(tree || [])
    setSongList(result)

  }, [tree, searchFilter])

  const createTreeStructure = (file: DirEntry | RecursiveDirEntry) => {
    if ("path" in file && file.name.toLowerCase().includes(searchFilter.toLowerCase())) {
      if (file.isDirectory && file.children.length !== 0 && file.children.find(item => item.isFile)) {
        return <MenuFolder key={file.path} $isMenuExtended={isMenuExtended}>
          <MenuButton>
            <ToolTip message={file.name}>
              <FolderIcon/>
              {isMenuExtended && <span>{file.name}</span>}
            </ToolTip>
          </MenuButton>
          <ul>{file.children && file.children.map(child => createTreeStructure(child))}</ul>
        </MenuFolder>
      } else if (file.isFile) {
        const isSelected = file.path === currentTabPath.replace(/\//g, '\\')
        
        return <MenuItem
          key={file.path}
          id={isSelected ? 'active' : undefined}
          $isSelected={isSelected}
          $isMenuExtended={isMenuExtended}
        >
          <MenuButton onClick={() => handleFilePathUpdate(file.path)}>
            <ToolTip message={file.name}>
              <FileIcon/>
              {isMenuExtended && <span>{file.name}</span>}
            </ToolTip>
          </MenuButton>
        </MenuItem>
      }
    }
  }

  const downloadTab = async () => {
    setSheetData(await doMe() ?? "")
  }
  
  const goToActiveTab = () => {
    const activeElement = document.getElementById('active')
    
    if (activeElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }

  const shuffleSong = () => {
    const randomSong = songList[Math.floor(Math.random() * songList.length)]
    handleFilePathUpdate(randomSong?.path ?? '', goToActiveTab)
  }

  const HandleQueueUpdate = () => {
    getQueue(streamerSongListUser)
      .then(async (data) => setSongQueue(await data?.json()))
  }

  useEffect(() => {
    if (streamerSongListEnabled) {
      HandleQueueUpdate()

      const intervalId = setInterval(() => {
        HandleQueueUpdate()
      }, 10000)

      return () => clearInterval(intervalId)
    }
  }, [streamerSongListUser, streamerSongListEnabled])

  return <MenuWrapper $isMenuExtended={isMenuExtended}>
    <li>
      <LogoIcon/>
      {isMenuExtended && 'KLANK'}
      <ToolTip message='Change theme'>
        <Button iconButton={true} icon={<ThemeIcon/>}
                onClick={() => setActiveTheme(activeTheme === 'Light' ? 'Dark' : 'Light')}/>
      </ToolTip>
    </li>
    <MenuToolbarItem $isMenuExtended={isMenuExtended}>
      <ToolTip message='Refresh'>
        <Button iconButton={true} icon={<RefreshIcon/>} disabled={isLoading}
                onClick={() => window.location.reload()}/>
      </ToolTip>
      <ToolTip message='Settings'>
        <Link href='/settings'>
          <Button iconButton={true} icon={<SettingsIcon/>} disabled={isLoading}/>
        </Link>
      </ToolTip>
      {
        streamerSongListEnabled
        && streamerSongListUser !== undefined
        && streamerSongListUser !== ""
        && isMenuExtended
        &&
        <ToolTip message='Update Queue'>
          <Button iconButton={true} icon={<QueueIcon/>} disabled={isLoading} onClick={() => HandleQueueUpdate()}/>
        </ToolTip>
      }
      <ToolTip message='Go to File'>
        <Button iconButton={true} icon={<TargetIcon/>} disabled={isLoading} onClick={goToActiveTab}/>
      </ToolTip>
      <ToolTip message='Shuffle Song'>
        <Button iconButton={true} icon={<ShuffleIcon/>} disabled={isLoading} onClick={shuffleSong}/>
      </ToolTip>
      <ToolTip message='Download Tab'>
        <Button iconButton={true} icon={<DownloadIcon/>} disabled={isLoading} onClick={downloadTab}/>
      </ToolTip>
    </MenuToolbarItem>
    <MenuDirectoryItem $isMenuExtended={isMenuExtended}>
      {
        isMenuExtended && <ToolTip message={baseDirectory ?? ''}><span>{baseDirectory}</span></ToolTip>
      }
      <ToolTip message='Change Folder'>
        <Button iconButton={true} icon={<FolderOpenIcon/>} disabled={isLoading}
                onClick={() => handleFolderPathUpdate()}/>
      </ToolTip>
    </MenuDirectoryItem>
    {
      streamerSongListEnabled
      && streamerSongListUser !== undefined
      && streamerSongListUser !== ""
      && isMenuExtended
      &&
      <SongQueue songQueue={songQueue} handleFilePathUpdate={handleQueuePathUpdate}/>
    }
    <MenuDirectoryContentListItem>
      {
        isLoading ? <LoadingIconContainer className='loading'><LoadingIcon/></LoadingIconContainer> : tree?.map(createTreeStructure)
      }
    </MenuDirectoryContentListItem>
    <Footer $isMenuExtended={isMenuExtended}>
      {

        isMenuExtended &&
        <Input
          value={searchFilter}
          onInput={(input) =>
            setSearchFilter(input.toString())}
          iconLeft={searchFilter.length > 0
            ? <CloseIcon onClick={() => setSearchFilter('')}/>
            : <SearchIcon/>}
        />
      }
      <Button
        iconButton={true}
        icon={<MenuToggleIcon isMenuExtended={isMenuExtended}/>}
        onClick={() => setIsMenuExtended(prevState => !prevState)}
      />
    </Footer>
  </MenuWrapper>
}

export default Menu