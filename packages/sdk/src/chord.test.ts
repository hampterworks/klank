// packages/sdk/src/chords.test.ts
import {delimiterMatcher, testChords, testTokenContext, transposeChord} from './chords';

describe('testChords function', () => {
  // Basic chords
  test('should validate basic chords', () => {
    expect(testChords('A')).toBe(true);
    expect(testChords('B')).toBe(true);
    expect(testChords('C')).toBe(true);
    expect(testChords('D')).toBe(true);
    expect(testChords('E')).toBe(true);
    expect(testChords('F')).toBe(true);
    expect(testChords('G')).toBe(true);
  });

  // Chords with accidentals
  test('should validate chords with accidentals', () => {
    expect(testChords('A#')).toBe(true);
    expect(testChords('Bb')).toBe(true);
    expect(testChords('C#')).toBe(true);
    expect(testChords('D♭')).toBe(true);
    expect(testChords('F##')).toBe(true);
    expect(testChords('G♭♭')).toBe(true);
  });

  // Chords with qualities
  test('should validate chords with qualities', () => {
    expect(testChords('Am')).toBe(true);
    expect(testChords('BM')).toBe(true);
    expect(testChords('Cmaj')).toBe(true);
    expect(testChords('Dmin')).toBe(true);
    expect(testChords('Esus')).toBe(true);
    expect(testChords('Fdim')).toBe(true);
    expect(testChords('Gadd')).toBe(true);
  });

  // Chords with numbers
  test('should validate chords with numbers', () => {
    expect(testChords('A7')).toBe(true);
    expect(testChords('Bmaj7')).toBe(true);
    expect(testChords('Cm9')).toBe(true);
    expect(testChords('D13')).toBe(true);
    expect(testChords('E11')).toBe(true);
  });

  // Complex chords with multiple components
  test('should validate complex chords', () => {
    expect(testChords('A#m7')).toBe(true);
    expect(testChords('Bbmaj9')).toBe(true);
    expect(testChords('C#dim7')).toBe(true);
    expect(testChords('Dsus4')).toBe(true);
    expect(testChords('Ebadd9')).toBe(true);
  });

  // Chords with bass notes
  test('should validate chords with bass notes', () => {
    expect(testChords('A/G')).toBe(true);
    expect(testChords('Bm/F#')).toBe(true);
    expect(testChords('C#maj7/B')).toBe(true);
    expect(testChords('D7/A')).toBe(true);
    expect(testChords('Em9/B')).toBe(true);
  });

  // Invalid chords
  test('should reject invalid chords', () => {
    expect(testChords('H')).toBe(false);  // H is not a valid note
    expect(testChords('A###')).toBe(false);  // Too many sharps
    expect(testChords('Bx')).toBe(false);  // Invalid modifier
    expect(testChords('C24')).toBe(false);  // Number too high
    expect(testChords('')).toBe(false);  // Empty string
    expect(testChords('AmM7b9##/H')).toBe(false);  // Invalid bass note
  });
});

describe('edge-case chords', () => {
  // two-digit numbers at bounds
  test('should allow 10–23 and reject 0 or 24+', () => {
    expect(testChords('C10')).toBe(true);
    expect(testChords('C23')).toBe(true);
    expect(testChords('C0')).toBe(false);
    expect(testChords('C24')).toBe(false);
  });

  // number → quality → number chains
  test('should allow first-number + quality + second-number', () => {
    expect(testChords('C7add9')).toBe(true);
    expect(testChords('Csus2add11')).toBe(true);
    expect(testChords('D13dim7')).toBe(true);
  });

  // unicode flats/sharps in the bass
  test('should handle unicode accidentals on the bass note', () => {
    expect(testChords('Cmaj7/B♭')).toBe(true);
    expect(testChords('C#m11/G♭♭')).toBe(true);
  });

  // mixing accidentals across root/chord positions
  test('should reject mixed-accidental combos if desired', () => {
    expect(testChords('C##b')).toBe(false);
  });

  // stray or malformed inputs
  test('should reject stray symbols and invalid formats', () => {
    expect(testChords('C-1')).toBe(false);
    expect(testChords('/A')).toBe(false);
    expect(testChords('A//G')).toBe(false);
    expect(testChords('A7b5')).toBe(false);   // unsupported “b5” modifier
    expect(testChords('Cmaj#')).toBe(false);
  });
});

describe('additional edge-case chords', () => {
  // Double-flats / double-sharps on the root (but ♯ not supported)
  test('should handle double-flats/sharps on the root', () => {
    expect(testChords('Cbb')).toBe(true);
    expect(testChords('D##')).toBe(true);
    expect(testChords('E♭♭min')).toBe(true);
    expect(testChords('F♯♯dim')).toBe(false);  // U+266F “♯” isn’t in our pattern
  });

  // Number → quality → number in mixed order
  test('should allow first-number + quality + second-number in any order', () => {
    expect(testChords('G7sus4')).toBe(true);
    expect(testChords('Cadd9')).toBe(true);
  });

  // Reject a stray quality with no number following
  test('should reject extra quality without a number', () => {
    expect(testChords('Cmajadd')).toBe(false);
    expect(testChords('Csusadd')).toBe(false);
  });

  // Edge-case numeric formats
  test('should reject zero-padded or out-of-range numbers', () => {
    expect(testChords('C00')).toBe(false);
    expect(testChords('C09')).toBe(false);
  });

  // Only one slash, and bass must be a valid chord
  test('should reject malformed slash/bass usage', () => {
    expect(testChords('A/')).toBe(false);
    expect(testChords('A//B')).toBe(false);
    expect(testChords('A/B/C')).toBe(false);
  });

  // No leading/trailing spaces or lowercase root
  test('should enforce no whitespace and uppercase root', () => {
    expect(testChords(' Cmaj7')).toBe(false);
    expect(testChords('Cmaj7 ')).toBe(false);
    expect(testChords('cmaj7')).toBe(false);
  });
});

describe('transposeChord', () => {
  it('returns the original chord when transpose is 0', () => {
    expect(transposeChord('Cmaj7', 0)).toBe('Cmaj7');
    expect(transposeChord('G#dim/B', 0)).toBe('G#dim/B');
  });

  it('moves a natural note up by semitones', () => {
    expect(transposeChord('C', 2)).toBe('D');      // 0 → 2
    expect(transposeChord('B', 1)).toBe('C');      // 11 → 12 → 0
    expect(transposeChord('E', 5)).toBe('A');      // 4 → 9
  });

  it('handles accidentals correctly', () => {
    expect(transposeChord('C#', 1)).toBe('D');     // (C=0 +#1) +1 → 2 ⇒ D
    expect(transposeChord('Db', 2)).toBe('D#');    // (D=2 +b–1) +2 → 3 ⇒ D#
    expect(transposeChord('Fb', 1)).toBe('F');     // (F=5 +b–1) +1 → 5 ⇒ F
  });

  it('preserves chord suffixes', () => {
    expect(transposeChord('Am7', 3)).toBe('Cm7');      // A=9 +3 → 12→0 ⇒ C
    expect(transposeChord('Gm6', -2)).toBe('Fm6');     // G=7 –2 → 5 ⇒ F
    expect(transposeChord('D7sus4', 5)).toBe('G7sus4');// D=2 +5 → 7 ⇒ G
  });

  it('transposes bass notes when present', () => {
    expect(transposeChord('C/E', 2)).toBe('D/F#');     // root C→D, bass E→F#
    expect(transposeChord('Bb/D', 2)).toBe('C/E');     // Bb→C, D→E
    expect(transposeChord('F#/A#', -3)).toBe('D#/G');  // F#→D#, A#→G
  });

  it('handles chords without a matched chord suffix', () => {
    expect(transposeChord('A', 4)).toBe('C#');         // A=9 +4 → 13→1 ⇒ C#
    expect(transposeChord('E/G#', -4)).toBe('C/E');    // E=4 –4 → 0⇒C; G#→E
  });

  it('handles double-digit transpose offsets and negative wrapping', () => {
    expect(transposeChord('C', 12)).toBe('C');         // full octave
    expect(transposeChord('C', -12)).toBe('C');        // full octave down
    expect(transposeChord('C', 14)).toBe('D');         // 12+2
    expect(transposeChord('E', -5)).toBe('B');         // 4 –5 → –1→11 ⇒ B
  });
});

describe('testTokenContext', () => {
  it('returns false for empty input or delimiters-only', () => {
    expect(testTokenContext([])).toBe(false);
    expect(testTokenContext(['|', ' ', '(', ')', '-'])).toBe(false);
  });

  it('returns false when all tokens (after filtering) are chords', () => {
    const tokens = ['C', '|', 'Dm7', '(', 'G#', ')', 'Fmaj'];
    expect(testTokenContext(tokens)).toBe(false);
  });

  it('returns false when all tokens (after filtering) are non-chords', () => {
    const tokens = ['hello', '|', 'world', '-', '123', 'foo'];
    expect(testTokenContext(tokens)).toBe(false);
  });

  it('returns true when mixed and chords ≤ others', () => {
    expect(testTokenContext(['|','C','|','hello'])).toBe(true);   // 1 chord, 1 other
    expect(testTokenContext(['C','hello','bye'])).toBe(true);     // 1 chord, 2 others
  });

  it('returns false when mixed but chords > others', () => {
    expect(testTokenContext(['C', 'Dm', 'hello'])).toBe(false);   // 2 chords, 1 other
  });


  it('treats a lyric‐style note plus chord as “text context” when chords ≤ others', () => {
    // ["Let","it","ring","C"] → chords=1, others=3 → true
    expect(testTokenContext(['Let', 'it', 'ring', 'C'])).toBe(true);
  });

  it('treats an “Intro” label plus a couple chords as text when equal counts', () => {
    // ["Intro","C","G"] → chords=2, others=1 → false (because chords>others)
    // but if we add one more word, becomes equal:
    expect(testTokenContext(['Intro', 'play', 'C', 'G'])).toBe(true); // 2 chords, 2 others
  });

  it('still flags a pure “Solo” plus chords line as chord‐context when chords > others', () => {
    // ["Solo","Am","Dm"] → chords=2, others=1 → false
    expect(testTokenContext(['Solo', 'Am', 'Dm'])).toBe(false);
  });
});