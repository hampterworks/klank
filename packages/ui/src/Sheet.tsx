"use client"

import styled from "styled-components";
import Chord from "./Chord";
import React from "react";
import useKlankStore from "web/state/store";
import {
  delimiterMatcher, isTablatureLine,
  testChords,
  testHeader,
  testSpaces,
  testTokenContext,
  transposeChord
} from "@repo/sdk/chords";

const SheetWrapper = styled.div<{$mode: string}>`
    overflow-y: ${props => props.$mode === 'Edit' ? 'none' : 'auto'};
    padding: ${props => props.$mode === 'Edit' ? '16px 0 0 16px' : '16px'};
    color: ${props => props.theme.textColor};
`
const ChordWrapper = styled.div<{ fontSize: number }>`
    white-space: pre;
    ${props => `font-size: ${props.fontSize}px`};
`
const Header = styled.div`
    margin: 32px 0;
`
const ChordLine = styled.div`
    margin-bottom: 8px;
`
const Lyric = styled.div`
    margin-bottom: 16px;
`

const lineMatcher = (line: string, index: number, transpose: number): React.ReactNode => {
  const tokens = line.split(delimiterMatcher).filter(token => token !== '')
  const sanitizedTokens = tokens.filter(token => !testSpaces(token))

  // Check if this is a tablature line
  const isTablature = isTablatureLine(line)

  // Check for chords, including lowercase 'e' for tablature
  const hasValidChords = tokens.some(token => testChords(token.replace('|', '')) || token === 'e')
  const isMixedContent = hasValidChords && testTokenContext(sanitizedTokens)

  if (hasValidChords && !isMixedContent) {
    const processedChords = line.split(delimiterMatcher).map((currentValue, i) => {
      if (testChords(currentValue) || currentValue === 'e') {
        const chordToTranspose = currentValue === 'e' ? 'E' : currentValue
      
      // Check if this is a string indicator (first token in a tablature line)
      const isStringIndicator = isTablature && i === 0

      return <Chord key={currentValue + index + i} isTablature={isTablature}>
        {isStringIndicator ? currentValue : transposeChord(chordToTranspose, transpose)}
      </Chord>
    }
    return <React.Fragment key={currentValue + index + i}>{currentValue}</React.Fragment>
  })
  return <ChordLine key={line + index}>{processedChords}</ChordLine>
}

  if (testHeader(line)) {
    return <Header key={line + index}>{line}</Header>
  }
  return <Lyric key={line + index}>{line}</Lyric>
}

type SheetProps = {
  data: string;
}

const Sheet: React.FC<SheetProps> = ({data, ...props}) => {
  const fontSize = useKlankStore().tab.fontSize
  const mode = useKlankStore().mode
  const transpose = useKlankStore().tab.transpose

  const lines: string[] = data.split(/\r?\n|\r|\n/g)
    .filter((line) => !testSpaces(line))

  return <SheetWrapper
    $mode={mode}
    {...props}>
    <ChordWrapper fontSize={fontSize}>
        {
          lines.map((line, index) =>
            lineMatcher(line, index, transpose)
          )
        }
      </ChordWrapper>
  </SheetWrapper>
}

export default Sheet