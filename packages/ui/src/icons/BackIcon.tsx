import * as React from "react";
import styled from "styled-components";


const SvgWrapper = styled.svg`
    path {
        fill: ${props => props.theme.textColor};
    }

`

const BackIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = () =>
  <SvgWrapper  width="24px" height="24px" viewBox="0 0 16 16" fill="none"
              xmlns="http://www.w3.org/2000/svg">
    <path d="M6 3L6 6H12L12 10H6L6 13L5 13L0 8L5 3L6 3Z" fill="#000000"/>
  </SvgWrapper>

export default BackIcon
