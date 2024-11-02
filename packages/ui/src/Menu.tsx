'use client'

import * as React from "react";
import ToolTip from "./ToolTip";
import Button from "./Button";
import RefreshIcon from "./icons/RefreshIcon";
import LoadingIcon from "./icons/LoadingIcon";
import styled from "styled-components";
import {FileTree, RecursiveDirEntry} from "./Application";
import {DirEntry} from "@tauri-apps/plugin-fs";
import useKlankStore from "web/state/store";

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

type MenuProps = {
    baseDirectory: string,
    tree?: FileTree
    isLoading: boolean
    setSheetData: (data: string) => void
    setIsRefreshTriggered: (isRefreshTriggered: boolean) => void
    handleFolderPathUpdate: () => void
    doMe: () => Promise<string | undefined>
    createTreeStructure: (file: DirEntry | RecursiveDirEntry) => React.ReactNode
} & React.ComponentPropsWithoutRef<'ul'>

const Menu: React.FC<MenuProps> = ({
                                       baseDirectory,
                                       tree,
                                       doMe,
                                       setIsRefreshTriggered,
                                       setSheetData,
                                       handleFolderPathUpdate,
                                       isLoading,
                                       createTreeStructure,
                                       ...props
                                   }) => {

    const activeTheme = useKlankStore().theme
    const setActiveTheme = useKlankStore().setTheme

    return <MenuWrapper>
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
        <MenuItem>
            <Button label='Change Theme' onClick={() => setActiveTheme(activeTheme === 'Light' ? 'Dark' : 'Light')}/>
        </MenuItem>
        {
            isLoading ? <li className='loading'><LoadingIcon/></li> : tree?.map(createTreeStructure)
        }
    </MenuWrapper>
}

export default Menu