import * as React from "react";
import styled from "styled-components";


const SvgWrapper = styled.svg<{ $isMenuExtended: boolean }>`
    path {
        fill: ${props => props.theme.textColor};
    }
    path:first-of-type {
        transform-origin: 40% 50%;
        transition: transform 300ms ease-in-out;
        transform: ${props => props.$isMenuExtended ? 'rotate(0)' : 'rotate(180deg)'};
    }
`
type ManuToggleIconProps = {
  isMenuExtended: boolean
} & React.ComponentPropsWithoutRef<'svg'>

const ManuToggleIcon: React.FC<ManuToggleIconProps> = ({isMenuExtended}) =>
  <SvgWrapper $isMenuExtended={isMenuExtended} width="16px" height="16px" viewBox="0 0 16 16" fill="none"
              xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3L6 6H12L12 10H6L6 13L5 13L0 8L5 3L6 3Z" fill="#000000"/>
    <path d="M16 2L16 14H14L14 2L16 2Z" fill="#000000"/>
  </SvgWrapper>

export default ManuToggleIcon
