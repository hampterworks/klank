"use client"

import styled from "styled-components";
import Chord from "./Chord";
import React, {useEffect, useRef, useState} from "react";
import useKlankStore, {Mode} from "web/state/store";

const SheetWrapper = styled.div<{$mode: string}>`
    overflow-y: ${props => props.$mode === 'Edit' ? 'none' : 'auto'};
    padding: ${props => props.$mode === 'Edit' ? '16px 0 0 16px' : '16px'};
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

const Textarea = styled.textarea<{$mode: string}>`
    width: 100%;
    height: calc(100vh - 100px); // menu 100px padding 16px margin 32px bottom padding 16px
`

const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

const delimiterMatcher = /(?<whitespace>\s+|\||\(|\))/

const chordMatcher = "((?<note>[A-G])(?<accidentals>(?:bb|b|♭♭|♭)|(?:##|#))?)(?<chords>([Mm]|maj|min|sus|dim|add)?(b|bb|♭|♭♭)?(#|##)?([1-9]|1[0-9]|2[0-3])?([Mm]|maj|min|sus|dim|add)?([1-9]|1[0-9]|2[0-3])?)?(?:\\/(?<bass>(?<bassNote>[A-G])(?<bassAccidentals>(?:b|bb|♭|♭♭)|(?:#|##))?))?"

const testHeader = (string: string) => /\[[a-zA-Z0-9\s]+/.test(string)
const testChords = (string: string) => {
  const match = (new RegExp("^" + chordMatcher + "$")).exec(string)

  if (match === null || match.length === 0)
    return false
  if (match[0] === string)
    return true
}
const testSpaces = (string: string) => /^\s*$/.test(string)

const getNoteOffset = (string: string | undefined) => {
  if (string === undefined) {
    return 0
  }
  const regex = /^(?<flats>bb|b|♭♭|♭)|(?<sharps>##|#)$/
  const accidentals = regex.exec(string)

  if (accidentals === null) {
    return 0
  } else if (["b", "bb", "♭", "♭♭"].includes(accidentals[0])) {
    return string.length * -1
  }
  return string.length
}

const normalizeNoteIndex = (noteNumber: number): number => ((noteNumber % notes.length) + notes.length) % notes.length

const matchChords = (string: string) => (new RegExp(`\\b${chordMatcher}\\b`).exec(string))

const transposeChord = (chord: string, transpose: number): string => {
  const currentNote = matchChords(chord)?.groups
  const matchedChords = currentNote?.chords

  if (transpose !== 0) {
    const noteIndex = notes.findIndex(sequenceNote => sequenceNote === currentNote?.note)
    const bassNoteIndex = notes.findIndex(sequenceNote => sequenceNote === currentNote?.bassNote)

    const transposedNoteIndex = normalizeNoteIndex(noteIndex + getNoteOffset(currentNote?.accidentals ?? '') + transpose)
    const transposedBassNoteIndex = currentNote?.bassNote !== undefined ? normalizeNoteIndex(bassNoteIndex + getNoteOffset(currentNote.bassAccidentals) + transpose) : null

    const bassChord = transposedBassNoteIndex !== null
      ? `/${notes[transposedBassNoteIndex]}`
      : '';

    return `${notes[transposedNoteIndex]}${bassChord}${matchedChords ?? ''}`
  }
  return chord
}

const lineMatcher = (line: string, index: number, transpose: number): React.ReactNode => {
  const tokens = line.split(delimiterMatcher).filter(token => token !== '')
  const filteredChordLine = tokens
    .filter((value) => testChords(value))
  if (filteredChordLine.length > 0) {
    const processedChords = line.split(delimiterMatcher).map((currentValue, i) => {
      if (testChords(currentValue.replace('|', ''))) {
        return <Chord key={currentValue + index + i}>{transposeChord(currentValue, transpose)}</Chord>
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
  const [editedTab, setEditedTab] = useState(data)
  const mode = useKlankStore().mode
  const transpose = useKlankStore().tab.transpose

  const lines: string[] = data.split(/\r?\n|\r|\n/g)
    .filter((line) => !testSpaces(line))

  return <SheetWrapper
    $mode={mode}
    {...props}>
    {mode === "Read" &&
      <ChordWrapper fontSize={fontSize}>
        {
          lines.map((line, index) =>
            lineMatcher(line, index, transpose)
          )
        }
      </ChordWrapper>
    }
    {mode === "Edit" &&
      <Textarea $mode={mode} id="tab-edit-textarea" defaultValue={data}
                onChange={event => setEditedTab(event.target.value)}/>
    }
  </SheetWrapper>
}

export default Sheet
