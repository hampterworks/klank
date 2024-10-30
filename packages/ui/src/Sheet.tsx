"use client"

import styled from "styled-components";
import Button from "./Button";
import Chord from "./Chord";
import Toolbar from "./Toolbar";
import PlayIcon from "./icons/PlayIcon";
import React, {useEffect, useRef, useState} from "react";
const SheetWrapper = styled.div`
    overflow-y: auto;
    padding: 16px;
`
const ChordWrapper = styled.div<{ fontSize: number }>`
    white-space: pre;
    ${props => `font-size: ${props.fontSize}px`};
`
const Header = styled.div`
  margin: 16px 0;
`
const ToolbarWrapper = styled.div`

`
const Lyric = styled.div`
    margin: 4px 0 16px 0;
`

const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

const spaceMatcher = /(?<whitespace>\s+)/

const chordMatcher = "((?<note>[A-G])(?<accidentals>(?:bb|b|♭♭|♭)|(?:##|#))?)(?<chords>([Mm]|maj|min|sus|dim|add)?(b|bb|♭|♭♭)?(#|##)?([1-9]|1[0-9]|2[0-3])?([Mm]|maj|min|sus|dim|add)?([1-9]|1[0-9]|2[0-3])?)?(?:\\/(?<bass>(?<bassNote>[A-G])(?<bassAccidentals>(?:b|bb|♭|♭♭)|(?:#|##))?))?"

const testHeader = (string: string) => /\[[a-zA-Z0-9]+\]/.test(string)
const testChords = (string: string) => (new RegExp("\\b" + chordMatcher + "\\b")).test(string)
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
  if (testChords(line)) {
    const trimmedLine = line.replace(/^\s*\S+\s*/, '')
    const isValidChord = trimmedLine.length > 0 ? testChords(trimmedLine) : true

    const processedChords = line.split(spaceMatcher).map((currentValue, i) => {
      if (!testSpaces(currentValue) && isValidChord && currentValue !== '|') {
        return <Chord key={currentValue + index + i}>{transposeChord(currentValue, transpose)}</Chord>
      }
      return <React.Fragment key={currentValue + index + i}>{currentValue}</React.Fragment>
    })
    return <div key={line + index}>{processedChords}</div>
  } else if (testHeader(line)) {
    return <Header key={line + index}>{line}</Header>
  }
  return <Lyric key={line + index}>{line}</Lyric>
}

const ButtonContainer = styled.div`
    display: flex;
    gap: 4px;
    font-weight: bold;
`
type ButtonProps = {
  onIncrement: (value: number) => void;
}

const IncrementDecrementButtons: React.FC<ButtonProps> = ({onIncrement}) => {
  return <ButtonContainer>
    <Button label='-1' onClick={() => {
      onIncrement(-1)
    }}/>
    <Button label='+1' onClick={() => {
      onIncrement(1)
    }}/>
  </ButtonContainer>
}

type SheetProps = {
  data: string;
}

const Sheet: React.FC<SheetProps> = ({data, ...props}) => {
  const [fontSize, setFontSize] = useState(16)
  const [transpose, setTranspose] = useState(0)
  const [scrollSpeed, setScrollSpeed] = useState(1)
  const [isScrolling, setIsScrolling] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleFontChange = (value: number) => {
    if (value < 0 && fontSize > 14) {
      setFontSize(fontSize + value)
    } else if (value > 0 && fontSize < 22) {
      setFontSize(fontSize + value)
    }
  }
  const isAtBottom = () => {
    if (scrollContainerRef.current) {
      const {scrollTop, scrollHeight} = scrollContainerRef.current;
      const offsetHeight = scrollContainerRef.current.offsetHeight;
      return scrollTop + offsetHeight >= scrollHeight;
    }
  }

  useEffect(() => {

    let interval: NodeJS.Timeout
    if (isScrolling) {
      interval = setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += scrollSpeed;
        }
        if (isAtBottom())
          setIsScrolling(false)
      }, 100)
    }

    return () => {
      clearInterval(interval)
    }
  }, [scrollSpeed, isScrolling])

  const handleTransposeChange = (value: number): void => {
    setTranspose(transpose + value)
  }

  const handleScrollSpeedChange = (value: number): void => {
    setScrollSpeed(prevState => (prevState === 0 && value < 0) ? prevState : prevState + value)
  }

  const lines: string[] = data.split(/\r?\n|\r|\n/g)
    .filter((line) => !testSpaces(line))

  return <SheetWrapper ref={scrollContainerRef} {...props}>
    <Toolbar>
      <li key='fontControl'>
        <span>Fonts {fontSize}px</span>
        <IncrementDecrementButtons onIncrement={handleFontChange}/>
      </li>
      <li key='transposeControl'>
        <span>Transpose {transpose}</span>
        <IncrementDecrementButtons onIncrement={handleTransposeChange}/>
      </li>
      <li key='autoscroll'>
        <span>Autoscroll {scrollSpeed}</span>
        <div>
          <Button label={isScrolling ? 'Stop' : 'Start'} onClick={() => {
            setIsScrolling(!isScrolling)
          }}/>
          <IncrementDecrementButtons onIncrement={handleScrollSpeedChange}/>
        </div>
      </li>
    </Toolbar>
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
