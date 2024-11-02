import * as React from "react";
import styled from "styled-components";

const SvgWrapper = styled.svg`
  line, path {
      stroke: ${props => props.theme.textColor};
  }

`

const ThemeIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = () =>
  <SvgWrapper id="Icons" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
      <line x1="14" y1="1" x2="14" y2="27" fill="none" strokeLinecap="round" strokeLinejoin="round"
            strokeWidth="2"/>
      <path d="M16,23A7,7,0,0,1,16,9" transform="translate(-2 -2)" fill="none" strokeLinecap="round"
            strokeLinejoin="round" strokeWidth="2"/>
      <line x1="4.81" y1="4.81" x2="6.93" y2="6.93" fill="none" strokeLinecap="round"
            strokeLinejoin="round" strokeWidth="2"/>
      <line x1="1" y1="14" x2="4" y2="14" fill="none" strokeLinecap="round" strokeLinejoin="round"
            strokeWidth="2"/>
      <line x1="4.81" y1="23.19" x2="6.93" y2="21.07" fill="none" strokeLinecap="round"
            strokeLinejoin="round" strokeWidth="2"/>
      <path d="M16,12.55A7,7,0,0,1,22.09,9l.47,0a5.25,5.25,0,1,0,6.44,8,7,7,0,0,1-13,2.39" transform="translate(-2 -2)"
            fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
  </SvgWrapper>


export default ThemeIcon
