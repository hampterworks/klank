import * as React from "react";
import styled from "styled-components";

const SvgWrapper = styled.svg`
  path {
      stroke: ${props => props.theme.textColor};
  }

`

const DownloadIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = () =>
  <SvgWrapper width="24px" height="24px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3 15C3 17.8284 3 19.2426 3.87868 20.1213C4.75736 21 6.17157 21 9 21H15C17.8284 21 19.2426 21 20.1213 20.1213C21 19.2426 21 17.8284 21 15"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 3V16M12 16L16 11.625M12 16L8 11.625" strokeWidth="1.5" strokeLinecap="round"
          strokeLinejoin="round"/>
  </SvgWrapper>

export default DownloadIcon
