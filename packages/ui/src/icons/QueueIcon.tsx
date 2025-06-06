import * as React from "react";
import styled from "styled-components";

const SvgWrapper = styled.svg`
  path {
      fill: ${props => props.theme.textColor};
  }

`

const QueueIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = () =>
  <SvgWrapper fill="#000000" width="24px" height="24px" viewBox="0 0 256 256" id="Flat" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M144,192a8.00008,8.00008,0,0,1-8,8H40a8,8,0,0,1,0-16h96A8.00008,8.00008,0,0,1,144,192ZM40,72H216a8,8,0,0,0,0-16H40a8,8,0,0,0,0,16Zm96,48H40a8,8,0,0,0,0,16h96a8,8,0,0,0,0-16Zm108.24023,33.21582-64-40A8.00044,8.00044,0,0,0,168,120v80a8.00043,8.00043,0,0,0,12.24023,6.78418l64-40a8.00062,8.00062,0,0,0,0-13.56836Z"/>
  </SvgWrapper>

export default QueueIcon
