"use client"

import styled from "styled-components";
import Button from "./Button";
import Chord from "./Chord";
import Toolbar from "./Toolbar";
import React, {useEffect, useRef, useState} from "react";

const SheetWrapper = styled.div<{$mode: string}>`
    overflow-y: ${props => props.$mode === 'Edit' ? 'none' : 'auto'};;
    padding: ${props => props.$mode === 'Edit' ? '16px 0 16px 16px' : '16px'};
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

const Textarea = styled.textarea`
    width: 100%;
    height: calc(100vh - 164px); // menu 100px padding 16px margin 32px bottom padding 16px
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

type Mode = "Read" | "Edit"

const Sheet: React.FC<SheetProps> = ({data, ...props}) => {
  const [fontSize, setFontSize] = useState(14)
  const [transpose, setTranspose] = useState(0)
  const [scrollSpeed, setScrollSpeed] = useState(1)
  const [isScrolling, setIsScrolling] = useState(false)
  const [editedTab, setEditedTab] = useState(data)
  const [mode, setMode] = useState<Mode>("Edit")
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const lastElementRef = useRef<HTMLDivElement>(null)

  const handleFontChange = (value: number) => {
    if (value < 0 && fontSize > 10) {
      setFontSize(fontSize + value)
    } else if (value > 0 && fontSize < 22) {
      setFontSize(fontSize + value)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isScrolling) {
      interval = setInterval(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop += scrollSpeed;
        }
      }, 80 / scrollSpeed)
    }

    return () => {
      clearInterval(interval)
    }
  }, [isScrolling, scrollSpeed, scrollContainerRef])

  const handleKeyInput = (event: KeyboardEvent): void => {
    console.log(mode)
    if (event.code === 'F2') {
      console.log("xouioui")
      setMode(mode === "Read" ? "Edit" : "Read")
      event.preventDefault()
      return
    }
    if (mode === "Read") {
      if (event.code === 'Space') {
        setIsScrolling(prevState => !prevState)
      } else if (event.code === 'ArrowUp') {
        setScrollSpeed(prevState => prevState + 1)
      } else if (event.code === 'ArrowDown' && scrollSpeed) {
        setScrollSpeed(prevState => Math.max(prevState - 1, 0))
      }
    }
  }

  useEffect(() => {
    let observer: IntersectionObserver

    document.addEventListener('keydown', handleKeyInput)

    if (lastElementRef.current !== null) {
      observer = new IntersectionObserver(entries => {
          const [entry] = entries
          if (entry?.isIntersecting)
            setIsScrolling(false)
        },
        {
          rootMargin: '0px',
          threshold: 1.0,
        })

      observer.observe(lastElementRef.current)

      return () => {
        document.removeEventListener('keydown', handleKeyInput)
        observer.disconnect();
      }
    }
    return () => {
      document.removeEventListener('keydown', handleKeyInput)
      if (observer) observer.disconnect()
    }
  }, [mode])

  const handleTransposeChange = (value: number): void => {
    setTranspose(transpose + value)
  }

  const handleScrollSpeedChange = (value: number): void => {
    setScrollSpeed(prevState => (prevState === 0 && value < 0) ? prevState : prevState + value)
  }

  const lines: string[] = data.split(/\r?\n|\r|\n/g)
    .filter((line) => !testSpaces(line))

  return <SheetWrapper
    $mode={mode}
    ref={scrollContainerRef}
    {...props}>
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
      <li>
        <span>Save</span>
        <Button label='Update' onClick={() => {

        }}/>
      </li>
    </Toolbar>
    {mode === "Read" &&
      <ChordWrapper fontSize={fontSize}>
        {
          lines.map((line, index) =>
            lineMatcher(line, index, transpose)
          )
        }
        <div ref={lastElementRef}/>
      </ChordWrapper>
    }
    {mode === "Edit" &&
      <Textarea id="kek" defaultValue={data}
                onChange={event => setEditedTab(event.target.value)}/>
    }
  </SheetWrapper>
}

export default Sheet
