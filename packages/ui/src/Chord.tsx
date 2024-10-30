"use client"

import * as React from "react";
import styled from "styled-components";

const ChordWrapper = styled.span`
    display: inline;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 2px;
    background: #e6e6e6;
    cursor: pointer;
`

type ChordProps = {
  children?: React.ReactNode;
} & React.ComponentPropsWithoutRef<'span'>

const Chord: React.FC<ChordProps> = ({ children, ...props }) => {
  return <ChordWrapper {...props}>
      {children}
    </ChordWrapper>
}

export default Chord
