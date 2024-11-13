'use client'

import * as React from "react";
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

const MenuWrapper = styled.ul<{$isMenuExtended: boolean}>`
    display: flex;
    flex-direction: column;
    border-right: 1px solid ${props => props.theme.borderColor};
    padding: 8px 8px 4px 8px;
    overflow: hidden;
    font-size: 14px;
    color: ${props => props.theme.textColor};

    > li:first-of-type {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 24px;
        font-weight: 600;
        ${props => !props.$isMenuExtended && 'flex-direction: column;'};
        button {
            margin-left: auto;
            padding: 0 8px;
        }
    }
`

const menuItemStyle = css<{ $isSelected?: boolean }>`
    gap: 4px;
    margin-bottom: 6px;
    overflow: hidden;
    background: ${props => props.$isSelected ? props.theme.selected : 'none'};
    padding: 2px;
`

const MenuToolbarItem = styled.li<{ $isSelected?: boolean }>`
    ${menuItemStyle};
    display: flex;
    align-items: center;
    justify-content: space-around;

    border-top: 1px solid ${props => props.theme.borderColor};
    border-bottom: 1px solid ${props => props.theme.borderColor};

    margin-top: 8px;

    button {
        padding: 0 6px;
    }
`

const MenuDirectoryContentListItem = styled.ul`
    overflow-y: auto;
    border-bottom: 1px solid ${props => props.theme.borderColor};
    height: calc(100% - 180px);

    button {
        margin-left: auto;
        padding: 0 6px;
    }
`

const MenuDirectoryItem = styled.li<{ $isSelected?: boolean }>`
    ${menuItemStyle};
    display: flex;
    align-items: center;
    border-bottom: 1px solid ${props => props.theme.borderColor};

    button {
        margin-left: auto;
        padding: 0 6px;
    }
`

const MenuFolder = styled.li<{ $isSelected?: boolean }>`
    ${menuItemStyle}
    > button {
        margin-bottom: 8px;
    }

    ul {
        margin-left: 8px;
    }
`
const MenuItem = styled.li<{ $isSelected?: boolean }>`
    ${menuItemStyle}
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

const Footer = styled.li<{$isMenuExtended: boolean}>`
    margin-top: auto;
    display: flex;
    justify-content: ${props => props.$isMenuExtended ? 'flex-end' : 'center'};
`

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

  const setCurrentTabPath = useKlankStore().setTabPath

  const handleFilePathUpdate = (path: string) => {
    setCurrentTabPath(path)
  }

  const createTreeStructure = (file: DirEntry | RecursiveDirEntry) => {
    if ("path" in file) {
      if (file.isDirectory && file.children.length !== 0 && file.children.find(item => item.isFile)) {
        return <MenuFolder key={file.path}>
          <MenuButton>
            <FolderIcon/>
            <span>{file.name}</span>
          </MenuButton>
          <ul>{file.children && file.children.map(child => createTreeStructure(child))}</ul>
        </MenuFolder>
      } else if (file.isFile) {
        return <MenuItem key={file.path} $isSelected={file.path === currentTabPath}>
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

  const downloadTab = async () => {
    setSheetData(await doMe() ?? "")
    setCurrentTabPath("")
  }

  return <MenuWrapper $isMenuExtended={isMenuExtended}>
    <li>
      <LogoIcon/>
      {isMenuExtended && 'KLANK'}
      <Button iconButton={true} icon={<ThemeIcon/>}
              onClick={() => setActiveTheme(activeTheme === 'Light' ? 'Dark' : 'Light')}/>
    </li>
    <MenuToolbarItem>
      <Button iconButton={true} icon={<RefreshIcon/>} disabled={isLoading}
              onClick={() => window.location.reload()}/>
      <Link href='/settings'>
        <Button iconButton={true} icon={<SettingsIcon/>} disabled={isLoading}/>
      </Link>
      {
        isMenuExtended && <Button iconButton={true} icon={<DownloadIcon/>} onClick={downloadTab}/>
      }
    </MenuToolbarItem>
    {
      isMenuExtended && <>
        <MenuDirectoryItem>
          <ToolTip message={baseDirectory ?? ''}>
            {baseDirectory}
          </ToolTip>
          <Button iconButton={true} icon={<FolderOpenIcon/>} disabled={isLoading} onClick={() => handleFolderPathUpdate()}/>
        </MenuDirectoryItem>
        <MenuDirectoryContentListItem>
          {
            isLoading ? <li className='loading'><LoadingIcon/></li> : tree?.map(createTreeStructure)
          }
        </MenuDirectoryContentListItem>
      </>
    }
    <Footer $isMenuExtended={isMenuExtended}>
      <Button
        iconButton={true}
        icon={<MenuToggleIcon isMenuExtended={isMenuExtended}/>}
        onClick={() => setIsMenuExtended(prevState => !prevState)}
      />
    </Footer>
  </MenuWrapper>
}

export default Menu
