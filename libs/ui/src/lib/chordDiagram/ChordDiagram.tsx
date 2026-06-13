import React from 'react'
import type { ChordVariant } from '@klank/platform-api'
import styles from './chordDiagram.module.css'

type ChordDiagramProps = {
  variant: ChordVariant
  strings: number
  className?: string
}

const NUM_FRETS = 5
const FRET_H = 16
const NUT_TOP = 22
const NUT_H = 4
const FRET_TOP = NUT_TOP + NUT_H
const MARKER_Y = 11
const LEFT = 14
const RIGHT = 94
const LABEL_X = 102
const DOT_R = 6

// x-coordinate for string i (0 = lowest/thickest)
const sx = (i: number, strings: number) => LEFT + (i * (RIGHT - LEFT)) / (strings - 1)

// y-center for diagram row r (1-indexed, 1 = first fret)
const dotY = (r: number) => FRET_TOP + (r - 0.5) * FRET_H

// Convert absolute fret number to diagram row (1-indexed)
const toRow = (fret: number, baseFret: number) => fret - baseFret + 1

export const ChordDiagram: React.FC<ChordDiagramProps> = ({ variant, strings, className }) => {
  const { frets, fingers, baseFret, barres } = variant

  const stringXs = Array.from({ length: strings }, (_, i) => sx(i, strings))

  return (
    <svg
      viewBox="0 0 110 115"
      className={`${styles.diagram} ${className ?? ''}`}
      role="img"
      aria-label="chord diagram"
    >
      {/* Open/muted string markers */}
      {frets.map((fret, i) => {
        const x = stringXs[i]
        if (fret === 0) {
          return (
            <circle
              key={`open-${i}`}
              cx={x}
              cy={MARKER_Y}
              r={4}
              className={styles.openMarker}
            />
          )
        }
        if (fret === -1) {
          return (
            <text key={`muted-${i}`} x={x} y={MARKER_Y + 4} className={styles.mutedMarker}>
              ✕
            </text>
          )
        }
        return null
      })}

      {/* Nut or top fret line */}
      {baseFret === 1 ? (
        <rect x={LEFT} y={NUT_TOP} width={RIGHT - LEFT} height={NUT_H} className={styles.nut} />
      ) : (
        <line x1={LEFT} y1={NUT_TOP} x2={RIGHT} y2={NUT_TOP} className={styles.fretLine} />
      )}

      {/* Fret lines */}
      {Array.from({ length: NUM_FRETS }, (_, r) => (
        <line
          key={`fret-${r}`}
          x1={LEFT}
          y1={FRET_TOP + r * FRET_H}
          x2={RIGHT}
          y2={FRET_TOP + r * FRET_H}
          className={styles.fretLine}
        />
      ))}

      {/* String lines */}
      {stringXs.map((x, i) => (
        <line
          key={`string-${i}`}
          x1={x}
          y1={NUT_TOP}
          x2={x}
          y2={FRET_TOP + NUM_FRETS * FRET_H}
          className={i === 0 ? styles.bassString : styles.stringLine}
        />
      ))}

      {/* Barre bars */}
      {barres.map((barre, i) => {
        const y = dotY(barre.fret)
        const x1 = stringXs[barre.fromString]
        const x2 = stringXs[barre.toString]
        return (
          <rect
            key={`barre-${i}`}
            x={x1 - DOT_R}
            y={y - DOT_R}
            width={x2 - x1 + DOT_R * 2}
            height={DOT_R * 2}
            rx={DOT_R}
            className={styles.barreDot}
          />
        )
      })}

      {/* Finger dots */}
      {frets.map((fret, i) => {
        if (fret <= 0) return null
        const row = toRow(fret, baseFret)
        if (row < 1 || row > NUM_FRETS) return null
        const x = stringXs[i]
        const y = dotY(row)
        const finger = fingers[i]
        return (
          <g key={`dot-${i}`}>
            <circle cx={x} cy={y} r={DOT_R} className={styles.dot} />
            {finger > 0 && (
              <text x={x} y={y + 4} className={styles.fingerNum}>
                {finger}
              </text>
            )}
          </g>
        )
      })}

      {/* BaseFret label */}
      {baseFret > 1 && (
        <text x={LABEL_X} y={dotY(1) + 4} className={styles.baseFretLabel}>
          {baseFret}fr
        </text>
      )}
    </svg>
  )
}
