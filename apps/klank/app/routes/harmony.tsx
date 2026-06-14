import styles from './harmony.module.css'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  SCALES,
  CHORD_QUALITIES,
  CHORD_ROOTS,
  NOTE_PITCH,
  INSTRUMENT_TUNING,
  pitchName,
  getScaleById,
  scalesForQuality,
  getScaleFretboard,
  getScalePositions,
  getDiatonicTriads,
  loadChordDiagrams,
  lookupChordDiagram,
  type ChordDiagramMap,
} from '@klank/platform-api'
import { useKlankStore } from '@klank/store'
import { ChordDiagram, FretboardDiagram } from '@klank/ui'

export default function Harmony() {
  const navigate = useNavigate()
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
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={() => navigate(-1)}>
          ← Back
        </button>
        <h1>Harmony</h1>
      </header>

      <div className={styles.content}>
        {/* ── Shared controls ─────────────────────────────────────────────── */}
        <section className={styles.section}>
          <div className={styles.row}>
            <span className={styles.label}>Key</span>
            <select
              className={styles.select}
              value={rootName}
              onChange={(e) => setHarmony({ rootPitch: NOTE_PITCH[e.target.value] ?? 0 })}
            >
              {CHORD_ROOTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>

            <span className={styles.label}>Instrument</span>
            <button
              className={styles.button}
              style={{ opacity: instrument === 'guitar' ? 1 : 0.5 }}
              onClick={() => setInstrument('guitar')}
            >
              Guitar
            </button>
            <button
              className={styles.button}
              style={{ opacity: instrument === 'bass' ? 1 : 0.5 }}
              onClick={() => setInstrument('bass')}
            >
              Bass
            </button>

            <button
              className={styles.button}
              onClick={() => setLabelMode((m) => m === 'degree' ? 'note' : 'degree')}
            >
              {labelMode === 'degree' ? 'Degrees' : 'Notes'}
            </button>
          </div>

          {/* Tab switcher */}
          <div className={styles.row}>
            {(
              [
                { tab: 'chords', label: 'Chords' },
                { tab: 'scales', label: 'Scales & Modes' },
                { tab: 'chord-scales', label: 'Chord-scales' },
              ] as const
            ).map(({ tab, label }) => (
              <button
                key={tab}
                className={`${styles.button}${harmony.tab === tab ? ' ' + styles.active : ''}`}
                onClick={() => setHarmony({ tab })}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* ── Tab: Chords ──────────────────────────────────────────────────── */}
        {harmony.tab === 'chords' && (
          <section className={styles.section}>
            <div className={styles.row}>
              <span className={styles.label}>Quality</span>
              <select
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
              const variants = lookupChordDiagram(chordMap, chordKey)
              return (
                <>
                  <div className={styles.chordName}>{chordKey || `${rootName} major`}</div>
                  {variants.length === 0 ? (
                    <div className={styles.emptyMessage}>No diagram available.</div>
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
          <section className={styles.section}>
            <div className={styles.row}>
              <span className={styles.label}>Scale</span>
              <select
                className={styles.select}
                value={scale.id}
                onChange={(e) => setHarmony({ scaleId: e.target.value })}
              >
                {(
                  // Group by category
                  (() => {
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
                  })()
                )}
              </select>
            </div>

            {/* Scale header */}
            <div className={styles.subheading}>
              {rootName} {scale.name}
            </div>

            {/* Mode info */}
            {scale.modeOf && scale.modeDegree != null && (
              <div className={styles.modeInfo}>
                Mode {scale.modeDegree} of {(() => {
                  const parent = getScaleById(scale.modeOf)
                  return parent ? parent.name : scale.modeOf
                })()}
              </div>
            )}

            {/* Legend: degree over note */}
            <div className={styles.legend}>
              {scale.intervals.map((interval, i) => {
                const notePitch = (rootPitch + interval) % 12
                return (
                  <div key={i} className={styles.legendItem}>
                    <span className={styles.legendDegree}>{scale.degrees[i]}</span>
                    <span className={styles.legendNote}>{pitchName(notePitch)}</span>
                  </div>
                )
              })}
            </div>

            {/* Full neck fretboard */}
            <div className={styles.fretboardFullWrap}>
              <div className={styles.fretboardFull}>
                <FretboardDiagram
                  grid={fullGrid}
                  labelMode={labelMode}
                  noteNames={noteNames}
                />
              </div>
            </div>

            {/* Position windows */}
            {(() => {
              const positions = getScalePositions(rootPitch, tuning)
              if (positions.length === 0) return null
              return (
                <>
                  <h3 className={styles.subheading}>Position windows</h3>
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
                </>
              )
            })()}

            {/* Diatonic triads */}
            {(() => {
              const withChords = getDiatonicTriads(rootPitch, scale)
                .filter((t): t is { degree: string; chordKey: string } => t.chordKey !== null)
              if (withChords.length === 0) return null
              return (
                <>
                  <h3 className={styles.subheading}>Diatonic triads</h3>
                  <div className={styles.chordGrid}>
                    {withChords.map((t) => {
                      const variants = lookupChordDiagram(chordMap, t.chordKey)
                      if (variants.length === 0) return null
                      return (
                        <div key={t.degree} className={styles.chordCard}>
                          <div className={styles.chordCaption}>{t.degree}: {t.chordKey}</div>
                          <ChordDiagram variant={variants[0]} strings={variants[0].frets.length} />
                        </div>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </section>
        )}

        {/* ── Tab: Chord-scales ─────────────────────────────────────────────── */}
        {harmony.tab === 'chord-scales' && (
          <section className={styles.section}>
            <div className={styles.row}>
              <span className={styles.label}>Quality</span>
              <select
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
              const compatibleScales = scalesForQuality(quality)
              if (compatibleScales.length === 0) {
                return (
                  <div className={styles.emptyMessage}>
                    No scales defined for this chord quality.
                  </div>
                )
              }
              return (
                <div>
                  {compatibleScales.map((s) => {
                    const csGrid = getScaleFretboard(rootPitch, s, tuning)
                    return (
                      <div key={s.id} className={styles.chordScaleItem}>
                        <div className={styles.chordScaleName}>
                          {rootName} {s.name}
                        </div>
                        <div className={styles.chordScaleCategory}>{s.category}</div>
                        <div className={styles.fretboardFullWrap}>
                          <div className={styles.fretboardFull}>
                            <FretboardDiagram
                              grid={csGrid}
                              labelMode={labelMode}
                              noteNames={noteNames}
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
