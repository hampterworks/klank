import styles from './harmony.module.css'
import { useEffect, useState } from 'react'
import {
  SCALES,
  CHORD_QUALITIES,
  CHORD_ROOTS,
  CHORD_INTERVALS,
  NOTE_PITCH,
  INSTRUMENT_TUNING,
  pitchName,
  getScaleById,
  scalesForQuality,
  getScaleFretboard,
  getScalePositions,
  getStepPattern,
  intervalName,
  getDiatonicTriads,
  parseChordKey,
  loadChordDiagrams,
  lookupChordDiagram,
  type ChordDiagramMap,
} from '@klank/platform-api'
import { useKlankStore } from '@klank/store'
import { ChordDiagram, FretboardDiagram } from '@klank/ui'

// Ordinal helper: 1 → "1st", 2 → "2nd", etc.
function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export function HarmonyPanel() {
  const instrument = useKlankStore().instrument
  const setInstrument = useKlankStore().setInstrument
  const harmony = useKlankStore().harmony
  const setHarmony = useKlankStore().setHarmony

  const rootPitch = harmony.rootPitch
  const scale = getScaleById(harmony.scaleId) ?? SCALES[0]
  const quality = harmony.quality

  const [labelMode, setLabelMode] = useState<'degree' | 'note'>('degree')
  const [chordMap, setChordMap] = useState<ChordDiagramMap>({})

  const tuning = INSTRUMENT_TUNING[instrument]
  const noteNames = Array.from({ length: 12 }, (_, i) => pitchName(i))
  // Open-string labels for FretboardDiagram (low-to-high)
  const stringLabels = tuning.map((p) => pitchName(p))

  // Load chord diagrams when instrument changes
  useEffect(() => {
    let cancelled = false
    loadChordDiagrams(instrument).then((map) => {
      if (!cancelled) setChordMap(map)
    })
    return () => { cancelled = true }
  }, [instrument])

  // Derive root name for display (find the CHORD_ROOTS entry matching rootPitch)
  const rootName = CHORD_ROOTS.find((r) => NOTE_PITCH[r] === rootPitch) ?? pitchName(rootPitch)

  // Full neck grid (reused by scales tab and chord-scales tab)
  const fullGrid = getScaleFretboard(rootPitch, scale, tuning)

  return (
    <div className={styles.panel}>
      <div className={styles.content}>
        {/* ── Shared controls ─────────────────────────────────────────────── */}
        <div className={styles.controlsBar}>
          {/* Key select */}
          <div className={styles.controlGroup}>
            <label className={styles.controlLabel} htmlFor="harmony-key-select">Key</label>
            <select
              id="harmony-key-select"
              className={styles.select}
              value={rootName}
              onChange={(e) => setHarmony({ rootPitch: NOTE_PITCH[e.target.value] ?? 0 })}
            >
              {CHORD_ROOTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Instrument segmented control */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel} id="harmony-instrument-label">Instrument</span>
            <div className={styles.segmented} role="group" aria-labelledby="harmony-instrument-label">
              <button
                className={`${styles.segBtn}${instrument === 'guitar' ? ' ' + styles.segBtnActive : ''}`}
                onClick={() => setInstrument('guitar')}
                aria-pressed={instrument === 'guitar'}
              >
                Guitar
              </button>
              <button
                className={`${styles.segBtn}${instrument === 'bass' ? ' ' + styles.segBtnActive : ''}`}
                onClick={() => setInstrument('bass')}
                aria-pressed={instrument === 'bass'}
              >
                Bass
              </button>
            </div>
          </div>

          {/* Labels segmented control */}
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel} id="harmony-labels-label">Labels</span>
            <div className={styles.segmented} role="group" aria-labelledby="harmony-labels-label">
              <button
                className={`${styles.segBtn}${labelMode === 'degree' ? ' ' + styles.segBtnActive : ''}`}
                onClick={() => setLabelMode('degree')}
                aria-pressed={labelMode === 'degree'}
              >
                Degrees
              </button>
              <button
                className={`${styles.segBtn}${labelMode === 'note' ? ' ' + styles.segBtnActive : ''}`}
                onClick={() => setLabelMode('note')}
                aria-pressed={labelMode === 'note'}
              >
                Notes
              </button>
            </div>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div className={styles.tabBar} role="tablist" aria-label="Harmony sections">
          {(
            [
              { tab: 'chords', label: 'Chords' },
              { tab: 'scales', label: 'Scales & Modes' },
              { tab: 'chord-scales', label: 'Chord-scales' },
            ] as const
          ).map(({ tab, label }) => (
            <button
              key={tab}
              role="tab"
              aria-selected={harmony.tab === tab}
              className={`${styles.tabBtn}${harmony.tab === tab ? ' ' + styles.tabBtnActive : ''}`}
              onClick={() => setHarmony({ tab })}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab: Chords ──────────────────────────────────────────────────── */}
        {harmony.tab === 'chords' && (
          <section className={styles.tabPanel}>
            <div className={styles.filterRow}>
              <label className={styles.controlLabel} htmlFor="harmony-chord-quality">Quality</label>
              <select
                id="harmony-chord-quality"
                className={styles.select}
                value={quality}
                onChange={(e) => setHarmony({ quality: e.target.value })}
              >
                {CHORD_QUALITIES.map((q) => (
                  <option key={q} value={q}>{q === '' ? 'major' : q}</option>
                ))}
              </select>
            </div>

            {(() => {
              const chordKey = rootName + quality
              const displayName = quality === '' ? `${rootName} major` : chordKey
              const variants = lookupChordDiagram(chordMap, chordKey)

              // Build a one-liner: "Notes: C E G  ·  1 3 5"
              const parsed = parseChordKey(chordKey)
              const intervals = parsed ? CHORD_INTERVALS[parsed.quality] : null
              const noteList = intervals
                ? intervals.map((i) => pitchName((rootPitch + i) % 12)).join('  ')
                : null
              const degreeLabels = intervals
                ? intervals.map((i) => {
                    const semis = ((i % 12) + 12) % 12
                    const names: Record<number, string> = {
                      0: '1', 1: 'b2', 2: '2', 3: 'b3', 4: '3', 5: '4',
                      6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7',
                    }
                    return names[semis] ?? String(i)
                  }).join('  ')
                : null

              return (
                <>
                  <div className={styles.chordHeading}>
                    <span className={styles.chordName}>{displayName}</span>
                    {noteList && (
                      <span className={styles.chordNoteInfo}>
                        {noteList}
                        <span className={styles.chordNoteInfoSep}> · </span>
                        {degreeLabels}
                      </span>
                    )}
                  </div>

                  {variants.length === 0 ? (
                    <p className={styles.emptyMessage}>No diagram available for this voicing.</p>
                  ) : (
                    <div className={styles.chordGrid}>
                      {variants.map((v, i) => (
                        <div key={i} className={styles.chordCard}>
                          <ChordDiagram variant={v} strings={v.frets.length} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </section>
        )}

        {/* ── Tab: Scales & Modes ──────────────────────────────────────────── */}
        {harmony.tab === 'scales' && (
          <section className={styles.tabPanel}>
            <div className={styles.filterRow}>
              <label className={styles.controlLabel} htmlFor="harmony-scale-select">Scale</label>
              <select
                id="harmony-scale-select"
                className={styles.select}
                value={scale.id}
                onChange={(e) => setHarmony({ scaleId: e.target.value })}
              >
                {(() => {
                  const groups: Record<string, typeof SCALES[number][]> = {}
                  for (const s of SCALES) {
                    if (!groups[s.category]) groups[s.category] = []
                    groups[s.category].push(s)
                  }
                  return Object.entries(groups).map(([cat, scales]) => (
                    <optgroup key={cat} label={cat}>
                      {scales.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  ))
                })()}
              </select>
            </div>

            {/* Primary block: always visible ─────────────────────────────── */}
            <div className={styles.scaleHeader}>
              <h2 className={styles.scaleTitle}>{rootName} {scale.name}</h2>
              <p className={styles.scaleDescription}>{scale.description}</p>
            </div>

            {/* Mode relationship */}
            {scale.modeOf != null && scale.modeDegree != null && (() => {
              const parent = getScaleById(scale.modeOf)
              if (!parent) return null
              const parentRootPitch = ((rootPitch - parent.intervals[scale.modeDegree - 1]) % 12 + 12) % 12
              const parentRootName = pitchName(parentRootPitch)
              return (
                <p className={styles.modeRelation}>
                  {ordinal(scale.modeDegree)} mode of{' '}
                  <strong>{parentRootName} {parent.name}</strong>
                </p>
              )
            })()}

            {/* Formula row */}
            <div className={styles.formulaRow}>
              <span className={styles.formulaLabel}>Formula</span>
              <span className={styles.formulaSteps}>{getStepPattern(scale).join(' – ')}</span>
            </div>

            {/* Note/degree legend chips */}
            <div className={styles.legend} aria-label="Scale degrees and notes">
              {scale.intervals.map((interval, i) => {
                const notePitch = (rootPitch + interval) % 12
                const isRoot = interval === 0
                return (
                  <div
                    key={i}
                    className={`${styles.legendChip}${isRoot ? ' ' + styles.legendChipRoot : ''}`}
                    title={intervalName(interval)}
                  >
                    <span className={styles.legendDegree}>{scale.degrees[i]}</span>
                    <span className={styles.legendNote}>{pitchName(notePitch)}</span>
                  </div>
                )
              })}
            </div>

            {/* Full-neck fretboard */}
            <div className={styles.fretboardFullWrap}>
              <div className={styles.fretboardFull}>
                <FretboardDiagram
                  grid={fullGrid}
                  labelMode={labelMode}
                  noteNames={noteNames}
                  stringLabels={stringLabels}
                  showFretNumbers
                />
              </div>
            </div>

            {/* Secondary detail: Positions (open by default) */}
            {(() => {
              const positions = getScalePositions(rootPitch, tuning)
              if (positions.length === 0) return null
              return (
                <details className={styles.disclosure} open>
                  <summary className={styles.disclosureSummary}>
                    Positions ({positions.length})
                  </summary>
                  <div className={styles.positionGrid}>
                    {positions.map((startFret) => (
                      <div key={startFret} className={styles.positionCard}>
                        <FretboardDiagram
                          grid={fullGrid}
                          startFret={startFret}
                          fretCount={5}
                          labelMode={labelMode}
                          noteNames={noteNames}
                        />
                      </div>
                    ))}
                  </div>
                </details>
              )
            })()}

            {/* Secondary detail: Diatonic chords (collapsed by default) */}
            {(() => {
              const withChords = getDiatonicTriads(rootPitch, scale)
                .filter((t): t is { degree: string; chordKey: string; roman: string } =>
                  t.chordKey !== null && t.roman !== null,
                )
              if (withChords.length === 0) return null
              return (
                <details className={styles.disclosure}>
                  <summary className={styles.disclosureSummary}>
                    Diatonic chords
                  </summary>
                  <div className={styles.chordGrid}>
                    {withChords.map((t) => {
                      const variants = lookupChordDiagram(chordMap, t.chordKey)
                      if (variants.length === 0) return null
                      return (
                        <div key={t.degree} className={styles.chordCard}>
                          <div className={styles.chordCaption}>
                            <span className={styles.romanNumeral}>{t.roman}</span>
                            {' — '}
                            {t.chordKey}
                          </div>
                          <ChordDiagram variant={variants[0]} strings={variants[0].frets.length} />
                        </div>
                      )
                    })}
                  </div>
                </details>
              )
            })()}
          </section>
        )}

        {/* ── Tab: Chord-scales ─────────────────────────────────────────────── */}
        {harmony.tab === 'chord-scales' && (
          <section className={styles.tabPanel}>
            <div className={styles.filterRow}>
              <label className={styles.controlLabel} htmlFor="harmony-cs-quality">Quality</label>
              <select
                id="harmony-cs-quality"
                className={styles.select}
                value={quality}
                onChange={(e) => setHarmony({ quality: e.target.value })}
              >
                {CHORD_QUALITIES.map((q) => (
                  <option key={q} value={q}>{q === '' ? 'major' : q}</option>
                ))}
              </select>
            </div>

            <p className={styles.chordScaleIntro}>
              Scales that fit a{' '}
              <strong>{rootName}{quality === '' ? ' major' : quality}</strong> chord.
            </p>

            {(() => {
              const compatibleScales = scalesForQuality(quality)
              if (compatibleScales.length === 0) {
                return (
                  <p className={styles.emptyMessage}>
                    No scales defined for this chord quality.
                  </p>
                )
              }
              return (
                <div className={styles.chordScaleList}>
                  {compatibleScales.map((s) => {
                    const csGrid = getScaleFretboard(rootPitch, s, tuning)
                    return (
                      <div key={s.id} className={styles.chordScaleItem}>
                        <div className={styles.chordScaleHeader}>
                          <span className={styles.chordScaleName}>{rootName} {s.name}</span>
                          <span className={styles.chordScaleCategory}>{s.category}</span>
                        </div>
                        <p className={styles.chordScaleDesc}>{s.description}</p>
                        <div className={styles.fretboardFullWrap}>
                          <div className={styles.fretboardFull}>
                            <FretboardDiagram
                              grid={csGrid}
                              labelMode={labelMode}
                              noteNames={noteNames}
                              stringLabels={stringLabels}
                              showFretNumbers
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </section>
        )}
      </div>
    </div>
  )
}
