'use client'

import React from "react";
import styled from "styled-components";
import Button from "./Button";
import BackIcon from "./icons/BackIcon";
import Link from "next/link";
import {open} from "@tauri-apps/plugin-shell";
import Typography from "./Typography";



const SettingsWrapper = styled.main`
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    div {
        display: flex;
        align-items: flex-end;
        gap: 8px;
    }
    div:first-of-type {
        display: block;
        margin-bottom: 16px;
    }
    button {
        margin-top: auto;
    }
`
const Settings: React.FC<React.ComponentPropsWithoutRef<'main'>> = ({...props}) => {
  return <SettingsWrapper>
    <Link href='/'><Button iconButton={true} icon={<BackIcon/>}/></Link>
    <div>
      <Typography variant='h1' component='h1'>KLANK</Typography>
      <Typography variant='h4' component='h2'>Music tabs management</Typography>
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
