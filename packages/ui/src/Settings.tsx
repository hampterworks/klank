'use client'

import React, {useState} from "react";
import styled from "styled-components";
import Button from "./Button";
import BackIcon from "./icons/BackIcon";
import Link from "next/link";
import {open} from "@tauri-apps/plugin-shell";
import Typography from "./Typography";
import Input from "./Input";
import useKlankStore from "web/state/store";
import getQueue from "@repo/sdk/getQueue";
import SuccessIcon from "./icons/SuccesIcon";
import ErrorIcon from "./icons/ErrorIcon";
import LoadingIcon from "./icons/LoadingIcon";
import SearchIcon from "./icons/SearchIcon";
import Checkbox from "./Checkbox";
import {log} from "node:util";


const SettingsWrapper = styled.main`
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;

    //div {
    //    display: flex;
    //    align-items: flex-end;
    //    gap: 8px;
    //}
    //
    //div:first-of-type {
    //    display: block;
    //    margin-bottom: 16px;
    //}
    //
    //button {
    //    margin-top: auto;
    //}
`

const Settings: React.FC<React.ComponentPropsWithoutRef<'main'>> = ({...props}) => {
  const streamerSongListUser = useKlankStore().streamerSongListUser
  const setStreamerSongListUser = useKlankStore().setStreamerSongListUser
  const streamerSongListEnabled = useKlankStore().streamerSongListEnabled
  const setStreamerSongListToggle = useKlankStore().setStreamerSongListToggle
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [queryState, setQueryState] = useState<React.ReactNode>(<SearchIcon/>)

  const handleInput = (input: string) => {
    const userInput = input.toString()

    if (timeoutId)
      clearTimeout(timeoutId)

    if (userInput === undefined || userInput.length === 0) {
      setStreamerSongListUser('')
      return
    }

    const id = setTimeout(() => {
      setQueryState(<LoadingIcon/>)
      getQueue(userInput)
        .then(data => {
          if (data?.status === 200) {
            setStreamerSongListUser(userInput)
            setQueryState(<SuccessIcon/>)
          } else {
            setQueryState(<ErrorIcon/>)
          }
        })
    }, 300)

    setTimeoutId(id)
  }

  return <SettingsWrapper>
    <Link href='/'><Button iconButton={true} icon={<BackIcon/>}/></Link>
    <div>
      <Typography variant='h1' component='h1'>KLANK</Typography>
      <Typography variant='h4' component='h2'>Music tabs management</Typography>
    </div>
    <div>
      <Checkbox
        label='Enable streamersonglist integration'
        name='streamersonglist'
        isChecked={streamerSongListEnabled}
        onChecked={(event) => setStreamerSongListToggle(event)}
      />
      {
        streamerSongListEnabled &&
        <Input
          label='streamersonglist user name'
          value={streamerSongListUser}
          onInput={input => handleInput(input.toString())}
          iconRight={queryState}
        />
      }
    </div>
    <div>
      Created by: <Typography variant='h4' component='h2'>HampterDoo</Typography>
    </div>
    <div>
      Special Thanks: <Typography variant='h4' component='h2'>Romni</Typography>
    </div>
    <Button label='Github' onClick={() => open('https://github.com/hampterworks/klank')}/>
  </SettingsWrapper>
}

export default Settings;
