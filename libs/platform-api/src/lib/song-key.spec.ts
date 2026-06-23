import { describe, it, expect } from 'vitest'
import { detectSongKey, formatSongKey, type SongKey } from './song-key.js'

describe('detectSongKey', () => {
  it('detects a clean I-IV-V-vi progression in C major (not A minor)', () => {
    const tab = Array.from({ length: 6 }, () => 'C    F    G    Am').join('\n')
    const result = detectSongKey(tab)
    expect(result).toEqual({ kind: 'single', key: { rootPitch: 0, isMinor: false } })
  })

  it('detects A minor when the minor tonic dominates a relative progression', () => {
    // Am appears twice as often as F/G/Em so its tonic-chord weight breaks
    // the tie with the relative major (C major shares the exact same 4 roots).
    const tab = Array.from({ length: 6 }, () => 'Am    Am    F    G    Em').join('\n')
    const result = detectSongKey(tab)
    expect(result).toEqual({ kind: 'single', key: { rootPitch: 9, isMinor: true } })
  })

  it('detects a clean key change across two sections', () => {
    const verse = ['[Verse]', ...Array.from({ length: 5 }, () => 'C    F    G    Am')]
    const bridge = ['[Bridge]', ...Array.from({ length: 5 }, () => 'D    G    A    Bm')]
    const tab = [...verse, ...bridge].join('\n')
    const result = detectSongKey(tab)
    expect(result).toEqual({
      kind: 'change',
      from: { rootPitch: 0, isMinor: false },
      to: { rootPitch: 2, isMinor: false },
      atSection: '[Bridge]',
    })
  })

  it('collapses sections that land on a relative major/minor pair into a single (major) key', () => {
    // Root-membership scoring can't distinguish a relative major/minor pair
    // with confidence - one section ties toward the major (the existing
    // tie-break default), another section's tonic weighting tips it toward
    // the relative minor. That's the same ambiguity resolving two different
    // ways, not an audible key change.
    const section = (chords: string) => Array.from({ length: 5 }, () => chords).join('\n')
    const tab = [
      '[Chorus]',
      section('C    F    G    Am'),
      '[Verse]',
      section('Am    Am    F    G    Em'),
      '[Chorus 2]',
      section('C    F    G    Am'),
    ].join('\n')
    expect(detectSongKey(tab)).toEqual({ kind: 'single', key: { rootPitch: 0, isMinor: false } })
  })

  it('collapses a relative-pair wobble that starts on the minor side into the major key', () => {
    const section = (chords: string) => Array.from({ length: 5 }, () => chords).join('\n')
    const tab = [
      '[Verse]',
      section('Am    Am    F    G    Em'),
      '[Bridge]',
      section('C    F    G    Am'),
      '[Verse 2]',
      section('Am    Am    F    G    Em'),
    ].join('\n')
    expect(detectSongKey(tab)).toEqual({ kind: 'single', key: { rootPitch: 0, isMinor: false } })
  })

  it('returns null when three or more distinct keys appear across sections', () => {
    const section = (chords: string) => Array.from({ length: 5 }, () => chords).join('\n')
    const tab = [
      '[Verse]',
      section('C    F    G    Am'),
      '[Bridge]',
      section('D    G    A    Bm'),
      '[Outro]',
      section('E    A    B    C#m'),
    ].join('\n')
    expect(detectSongKey(tab)).toBeNull()
  })

  it('returns null when a key reappears after switching away (back-and-forth)', () => {
    const section = (chords: string) => Array.from({ length: 5 }, () => chords).join('\n')
    const tab = [
      '[Verse]',
      section('C    F    G    Am'),
      '[Bridge]',
      section('D    G    A    Bm'),
      '[Verse 2]',
      section('C    F    G    Am'),
    ].join('\n')
    expect(detectSongKey(tab)).toBeNull()
  })

  it('returns null for too few / ambiguous chords', () => {
    expect(detectSongKey('')).toBeNull()
    expect(detectSongKey('A5    E5    A5    E5')).toBeNull()
  })

  it('returns null for a single section with too few chord occurrences', () => {
    expect(detectSongKey('C    F')).toBeNull()
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
