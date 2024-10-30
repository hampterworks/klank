"use client"

import React from "react";
import styled, {css} from "styled-components";

const IconWrapper = styled.svg<{$sx?: ReturnType<typeof css>}>`
    height: 24px;
    ${props => props.$sx}
`

type InfoIconProps = {
  $sx?: ReturnType<typeof css>
} & React.ComponentPropsWithoutRef<'svg'>

const InfoIcon: React.FC<InfoIconProps> = ({$sx, ...props}) => {
  return <IconWrapper
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    $sx={$sx}
    {...props}
  >
    <g>
      <path fill="#1C274C" d="M12,23.3c-1.5,0-3-0.3-4.4-0.9C6.3,21.8,5.1,21,4,20s-1.8-2.2-2.4-3.6C1,15,0.7,13.5,0.7,12
		c0-1.5,0.3-3,0.9-4.4C2.2,6.3,3,5.1,4,4s2.2-1.8,3.6-2.4C9,1,10.5,0.7,12,0.7c1.5,0,3,0.3,4.4,0.9C17.7,2.2,18.9,3,20,4
		s1.8,2.2,2.4,3.6C23,9,23.3,10.5,23.3,12c0,1.5-0.3,3-0.9,4.4C21.8,17.7,21,18.9,20,20s-2.2,1.8-3.6,2.4C15,23,13.5,23.3,12,23.3z
		 M12,2.3c-5.3,0-9.7,4.3-9.7,9.7s4.3,9.7,9.7,9.7s9.7-4.3,9.7-9.7S17.3,2.3,12,2.3z"/>
    </g>
    <g>
      <path fill="#1C274C"
            d="M12,18c-0.4,0-0.8-0.4-0.8-0.8V11c0-0.4,0.4-0.8,0.8-0.8s0.8,0.4,0.8,0.8v6.3C12.8,17.7,12.4,18,12,18z"/>
    </g>
    <g>
      <circle fill="#1C274C" cx="12" cy="7.8" r="1"/>
    </g>
  </IconWrapper>
}

export default InfoIcon
