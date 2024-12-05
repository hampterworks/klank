"use client"

import React from "react";
import styled, {css} from "styled-components";

const IconWrapper = styled.svg<{ $isToggled: boolean }>`
    path {
        fill: #1b1b1b;

        &:last-of-type {
            fill: #0e7017;
            ${props => props.$isToggled ? css`display: block` : css`display: none`}
        }
    }

`

type CheckProps = {
  isToggled?: boolean
} & React.ComponentPropsWithoutRef<'svg'>

const Check: React.FC<CheckProps> = ({isToggled, ...props}) => {
  return <IconWrapper
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    height='24px'
    $isToggled={isToggled !== undefined ? isToggled : false}
    {...props}
  >
    <path
      d="M19.61,1H4.39A3.35,3.35,0,0,0,1,4.39V19.61A3.35,3.35,0,0,0,4.39,23H19.61A3.35,3.35,0,0,0,23,19.61V4.39A3.35,3.35,0,0,0,19.61,1Zm1.52,18.57a1.52,1.52,0,0,1-1.52,1.52H4.39a1.52,1.52,0,0,1-1.52-1.52V4.39A1.52,1.52,0,0,1,4.39,2.87H19.61a1.52,1.52,0,0,1,1.52,1.52Z"
      transform="translate(-1.04 -1.04)"/>
    <path
      d="M9.56,15l7.88-7.88a.91.91,0,0,1,1.38,1.19l-.08.1-8.53,8.53A.93.93,0,0,1,9,17l-.1-.09L5.26,13.25a.91.91,0,0,1,1.19-1.38l.11.09,3,3,7.88-7.88Z"
      transform="translate(-1.04 -1.04)"/>
  </IconWrapper>
}

export default Check
