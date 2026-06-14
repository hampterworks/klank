import * as React from 'react'
import type { FretCell } from '@klank/platform-api'
import styles from './fretboardDiagram.module.css'

export type FretboardDiagramProps = {
  grid: (FretCell | null)[][]
  startFret?: number
  fretCount?: number
  labelMode?: 'degree' | 'note'
  noteNames?: readonly string[]
  className?: string
}

// ── Layout constants (mirror ChordDiagram's named-constant style) ─────────────
const CELL_W = 26       // width per fret cell
const STRING_GAP = 18   // vertical gap between strings
const TOP = 18          // top padding (above first string)
const LEFT_PAD = 10     // left margin before nut / fret lines
const OPEN_COL_W = 18   // extra width for the open-string column (when startFret === 0)
const BASE_LABEL_W = 28 // right margin for base-fret label when startFret > 0
const DOT_R = 7         // dot circle radius
const INLAY_R = 3       // inlay dot radius

// Absolute frets that get inlay markers (single dot)
const INLAY_FRETS = new Set([3, 5, 7, 9])
// Double-inlay fret
const DOUBLE_INLAY_FRET = 12

// y-coordinate for string s (index 0 = lowest/bass = BOTTOM of diagram)
function stringY(s: number, numStrings: number): number {
  return TOP + (numStrings - 1 - s) * STRING_GAP
}

export const FretboardDiagram: React.FC<FretboardDiagramProps> = ({
  grid,
  startFret = 0,
  fretCount = 12,
  labelMode = 'degree',
  noteNames,
  className,
}) => {
  const numStrings = grid.length
  if (numStrings === 0) return null

  const hasOpenCol = startFret === 0
  const leftEdge = LEFT_PAD + (hasOpenCol ? OPEN_COL_W : 0)
  // Absolute fret shown in the first cell column. With an open column (full
  // neck) the open string is fret 0 and the first cell is fret 1; a position
  // window starts ON its anchor fret so the root is included.
  const firstCellFret = hasOpenCol ? 1 : startFret

  // Total width: leftEdge + fretCount cells + optional right label space
  const rightLabelW = startFret > 0 ? BASE_LABEL_W : 0
  const totalW = leftEdge + fretCount * CELL_W + rightLabelW
  const totalH = TOP + (numStrings - 1) * STRING_GAP + TOP

  // x-coordinate of the leftmost fret line (nut position or top fret line)
  const nutX = leftEdge

  // Helper: get label text for a cell
  const getCellLabel = (cell: FretCell): string => {
    if (labelMode === 'note' && noteNames) {
      return noteNames[((cell.pitch % 12) + 12) % 12] ?? cell.degree
    }
    return cell.degree
  }

  // Collect which absolute frets are in the shown window for inlay rendering
  const visibleFrets: number[] = []
  for (let i = 0; i < fretCount; i++) {
    visibleFrets.push(firstCellFret + i)
  }

  return (
    <svg
      viewBox={`0 0 ${totalW} ${totalH}`}
      className={`${styles.diagram} ${className ?? ''}`}
      role="img"
      aria-label="scale diagram"
    >
      {/* Nut (thick rect) or top fret line */}
      {hasOpenCol ? (
        <rect
          x={nutX}
          y={TOP - 2}
          width={4}
          height={(numStrings - 1) * STRING_GAP + 4}
          className={styles.nut}
        />
      ) : (
        <line
          x1={nutX}
          y1={TOP}
          x2={nutX}
          y2={TOP + (numStrings - 1) * STRING_GAP}
          className={styles.fretLine}
        />
      )}

      {/* Vertical fret lines */}
      {Array.from({ length: fretCount }, (_, i) => {
        const x = nutX + (i + 1) * CELL_W
        return (
          <line
            key={`fret-${i}`}
            x1={x}
            y1={TOP}
            x2={x}
            y2={TOP + (numStrings - 1) * STRING_GAP}
            className={styles.fretLine}
          />
        )
      })}

      {/* Horizontal string lines */}
      {Array.from({ length: numStrings }, (_, s) => {
        const y = stringY(s, numStrings)
        // Low string (s===0) at bottom = thicker
        const isLowest = s === 0
        return (
          <line
            key={`string-${s}`}
            x1={hasOpenCol ? nutX - OPEN_COL_W : nutX}
            y1={y}
            x2={nutX + fretCount * CELL_W}
            y2={y}
            className={isLowest ? styles.bassString : styles.stringLine}
          />
        )
      })}

      {/* Inlay dots */}
      {(() => {
        const midY = TOP + ((numStrings - 1) / 2) * STRING_GAP
        return visibleFrets.map((absFret, idx) => {
          const slotX = nutX + idx * CELL_W + CELL_W / 2
          if (absFret === DOUBLE_INLAY_FRET) {
            const offset = STRING_GAP * 0.4
            return (
              <g key={`inlay-${absFret}`}>
                <circle cx={slotX} cy={midY - offset} r={INLAY_R} className={styles.inlay} />
                <circle cx={slotX} cy={midY + offset} r={INLAY_R} className={styles.inlay} />
              </g>
            )
          }
          if (INLAY_FRETS.has(absFret)) {
            return (
              <circle key={`inlay-${absFret}`} cx={slotX} cy={midY} r={INLAY_R} className={styles.inlay} />
            )
          }
          return null
        })
      })()}

      {/* Open-string column dots (fret 0) when hasOpenCol */}
      {hasOpenCol && Array.from({ length: numStrings }, (_, s) => {
        const cell = grid[s]?.[0]
        if (!cell) return null
        const x = nutX - OPEN_COL_W / 2
        const y = stringY(s, numStrings)
        const label = getCellLabel(cell)
        return (
          <g key={`open-dot-${s}`}>
            <circle
              cx={x}
              cy={y}
              r={DOT_R}
              className={cell.isRoot ? styles.dotRoot : styles.dot}
            />
            <text
              x={x}
              y={y}
              className={styles.dotLabel}
            >
              {label}
            </text>
          </g>
        )
      })}

      {/* Fretted dots */}
      {Array.from({ length: numStrings }, (_, s) => {
        const row = grid[s]
        if (!row) return null
        return Array.from({ length: fretCount }, (_, fi) => {
          const f = firstCellFret + fi
          const cell = row[f]
          if (!cell) return null
          const x = nutX + fi * CELL_W + CELL_W / 2
          const y = stringY(s, numStrings)
          const label = getCellLabel(cell)
          return (
            <g key={`dot-${s}-${f}`}>
              <circle
                cx={x}
                cy={y}
                r={DOT_R}
                className={cell.isRoot ? styles.dotRoot : styles.dot}
              />
              <text
                x={x}
                y={y}
                className={styles.dotLabel}
              >
                {label}
              </text>
            </g>
          )
        })
      })}

      {/* Base fret label (e.g. "5fr") when startFret > 0 */}
      {startFret > 0 && (
        <text
          x={nutX + fretCount * CELL_W + 4}
          y={TOP + ((numStrings - 1) / 2) * STRING_GAP}
          className={styles.baseFretLabel}
        >
          {startFret}fr
        </text>
      )}
    </svg>
  )
}
