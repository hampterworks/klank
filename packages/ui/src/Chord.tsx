"use client"

import * as React from "react";
import styled, {css} from "styled-components";

const ChordWrapper = styled.span<{ $isTablature?: boolean }>`
    display: inline;
    font-weight: bold;
    padding: 1px 4px;
    margin-right: 8px;
    border-radius: 2px;
    background: ${props => props.theme.highlight};
    cursor: pointer;
    ${props => props.$isTablature && css`
        display: inline-block;
        min-width: 3ch;
        text-align: center;
        padding: 0;
        margin-right: 4px;
    `}
`

type ChordProps = {
  children?: React.ReactNode;
  isTablature?: boolean;
} & React.ComponentPropsWithoutRef<'span'>

const Chord: React.FC<ChordProps> = ({ children, isTablature = false, ...props }) => {
  return <ChordWrapper $isTablature={isTablature} {...props}>
      {children}
    </ChordWrapper>
}

export default Chord