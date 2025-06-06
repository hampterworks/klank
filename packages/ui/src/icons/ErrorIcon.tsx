import * as React from "react";
import styled from "styled-components";

const SvgWrapper = styled.svg`
  path {
      fill: ${props => props.theme.fail};
  }

`

const ErrorIcon: React.FC<React.ComponentPropsWithoutRef<'svg'>> = () =>
  <SvgWrapper width="24px" height="24px" viewBox="0 0 512 512" version="1.1" xmlns="http://www.w3.org/2000/svg">
    <title>error-filled</title>
    <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
      <g id="add" fill="#000000" transform="translate(42.666667, 42.666667)">
        <path
          d="M213.333333,3.55271368e-14 C331.136,3.55271368e-14 426.666667,95.5306667 426.666667,213.333333 C426.666667,331.136 331.136,426.666667 213.333333,426.666667 C95.5306667,426.666667 3.55271368e-14,331.136 3.55271368e-14,213.333333 C3.55271368e-14,95.5306667 95.5306667,3.55271368e-14 213.333333,3.55271368e-14 Z M262.250667,134.250667 L213.333333,183.168 L164.416,134.250667 L134.250667,164.416 L183.168,213.333333 L134.250667,262.250667 L164.416,292.416 L213.333333,243.498667 L262.250667,292.416 L292.416,262.250667 L243.498667,213.333333 L292.416,164.416 L262.250667,134.250667 Z"
          id="Combined-Shape">
        </path>
      </g>
    </g>
  </SvgWrapper>

export default ErrorIcon
