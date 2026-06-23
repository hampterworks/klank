import { describe, it, expect } from 'vitest'
import { detectSongKey, formatSongKey, type SongKey } from './song-key.js'

const lines = (chords: string, count = 6) => Array.from({ length: count }, () => chords).join('\n')

describe('detectSongKey', () => {
  it('detects a clean I-IV-V-vi progression in C major (not A minor)', () => {
    // C and A minor share all four roots and tie exactly; the relative-pair
    // tie-break defaults to the major.
    expect(detectSongKey(lines('C    F    G    Am'))).toEqual({ rootPitch: 0, isMinor: false })
  })

  it('detects A minor when the minor tonic dominates a relative progression', () => {
    // Am appears twice as often as F/G/Em so its tonic-chord weight breaks the
    // tie with the relative major (C major shares the exact same roots).
    expect(detectSongKey(lines('Am    Am    F    G    Em'))).toEqual({ rootPitch: 9, isMinor: true })
  })

  it('pools the whole song into one key when sections lean on different in-key tonics', () => {
    // A verse emphasising the tonic and a chorus emphasising the dominant are
    // one key, not a change — both use only C-major chords. Per-section scoring
    // used to report a false C→G "change"; pooling reports a single C.
    const tab = [
      '[Verse]',
      lines('C    F    G    Am', 5),
      '[Chorus]',
      lines('G    D    C    Em', 5),
    ].join('\n')
    expect(detectSongKey(tab)).toEqual({ rootPitch: 0, isMinor: false })
  })

  it('returns null when no single key fits the chords well enough', () => {
    // A whole-tone set of roots — no major or natural-minor scale contains
    // more than four of them, so nothing clears the confidence threshold.
    expect(detectSongKey(lines('C    D    E    F#    G#    A#'))).toBeNull()
  })

  it('returns null for too few / ambiguous chords', () => {
    expect(detectSongKey('')).toBeNull()
    expect(detectSongKey('A5    E5    A5    E5')).toBeNull()
  })

  it('returns null for too few chord occurrences', () => {
    expect(detectSongKey('C    F')).toBeNull()
  })

  describe('capo (sounding key)', () => {
    it('shifts the detected as-written key up by a numeric capo', () => {
      const tab = ['Capo 2', lines('C    F    G    Am')].join('\n')
      expect(detectSongKey(tab)).toEqual({ rootPitch: 2, isMinor: false })
    })

    it('reads a Roman-numeral capo', () => {
      const tab = ['Capo III', lines('Am    Am    F    G    Em')].join('\n')
      // A minor (root 9) + 3 semitones = C minor (root 0).
      expect(detectSongKey(tab)).toEqual({ rootPitch: 0, isMinor: true })
    })

    it('reads a spelled-out capo on a fret', () => {
      const tab = ['Capo on the second fret', lines('C    F    G    Am')].join('\n')
      expect(detectSongKey(tab)).toEqual({ rootPitch: 2, isMinor: false })
    })

    it('ignores a "no capo" annotation', () => {
      const tab = ['No Capo', lines('C    F    G    Am')].join('\n')
      expect(detectSongKey(tab)).toEqual({ rootPitch: 0, isMinor: false })
    })

    it('ignores an out-of-range capo', () => {
      const tab = ['Capo 99', lines('C    F    G    Am')].join('\n')
      expect(detectSongKey(tab)).toEqual({ rootPitch: 0, isMinor: false })
    })
  })
})

describe('formatSongKey', () => {
  it('formats a major key with no transpose', () => {
    expect(formatSongKey({ rootPitch: 0, isMinor: false })).toBe('C')
  })

  it('formats a minor key with no transpose', () => {
    expect(formatSongKey({ rootPitch: 9, isMinor: true })).toBe('Am')
  })

  it('shifts the root by the transpose amount, wrapping at the octave', () => {
    const cMajor: SongKey = { rootPitch: 0, isMinor: false }
    expect(formatSongKey(cMajor, 2)).toBe('D')
    expect(formatSongKey(cMajor, -1)).toBe('B')
    expect(formatSongKey(cMajor, 12)).toBe('C')
    expect(formatSongKey(cMajor, -12)).toBe('C')
  })
})
