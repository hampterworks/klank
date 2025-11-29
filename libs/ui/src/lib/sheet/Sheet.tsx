import React from 'react'
import styles from './sheet.module.css'
import {
  delimiterMatcher,
  isTablatureLine,
  testChords,
  testHeader,
  testSpaces,
  testTokenContext,
  transposeChord,
} from '@klank/platform-api'

const lineMatcher = (
  line: string,
  index: number,
  transpose: number
): React.ReactNode => {
  const tokens = line.split(delimiterMatcher).filter((token) => token !== '')
  const sanitizedTokens = tokens.filter((token) => !testSpaces(token))

  // Check if this is a tablature line
  const isTablature = isTablatureLine(line)

  // Check for chords, including lowercase 'e' for tablature
  const hasValidChords = tokens.some(
    (token) => testChords(token.replace('|', '')) || token === 'e'
  )
  const isMixedContent = hasValidChords && testTokenContext(sanitizedTokens)

  if (hasValidChords && !isMixedContent) {
    const processedChords = line
      .split(delimiterMatcher)
      .map((currentValue, i) => {
        if (testChords(currentValue) || currentValue === 'e') {
          const chordToTranspose = currentValue === 'e' ? 'E' : currentValue

          // Check if this is a string indicator (first token in a tablature line)
          const isStringIndicator = isTablature && i === 0
          //isTablature={isTablature}
          return (
            <span className={styles.chord} key={currentValue + index + i}>
              {isStringIndicator
                ? currentValue
                : transposeChord(chordToTranspose, transpose)}
            </span>
          )
        }
        return (
          <React.Fragment key={currentValue + index + i}>
            {currentValue}
          </React.Fragment>
        )
      })
    return <div key={line + index}>{processedChords}</div>
  }

  if (testHeader(line)) {
    return <div key={line + index}>{line}</div>
  }
  return <div key={line + index}>{line}</div>
}

type SheetProps = {
  tabData: string
  transpose: number
  tabScrollSpeed: number
  isScrolling: boolean
} & React.ComponentPropsWithRef<'pre'>

const Sheet: React.FC<SheetProps> = ({
  tabData,
  transpose,
  tabScrollSpeed,
  isScrolling,
  ...props
}) => {

  const lines: string[] = tabData
    .split(/\r?\n|\r|\n/g)
    .filter((line) => !testSpaces(line))

  return (
    <pre className={styles.container} {...props}>
      {lines.map((line, index) => lineMatcher(line, index, transpose))}
    </pre>
  )
}

export default Sheet
