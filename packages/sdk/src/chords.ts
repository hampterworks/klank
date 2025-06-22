export const notes = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#']

export const delimiterMatcher = /(?<whitespace>\s+|\||\(|\)|-)/

// Note pattern - captures the basic note and any accidentals
const notePattern = "(?<note>[A-G])(?<accidentals>(?:bb|b|♭♭|♭)|(?:##|#))?"

// Chord quality pattern - captures chord types and modifications
const chordQualityPattern = '(maj|[Mm]|min|sus|dim|add)?'
const chordQualityRequired = '(?:maj|[Mm]|min|sus|dim|add)'
const chordNumberPattern = '(?:[1-9]|1[0-9]|2[0-3])?'
const chordNumberRequiredPattern = '(?:[1-9]|1[0-9]|2[0-3])'

const noTriples = '^(?!.*(?:#{3}|b{3}|♭{3}))'

// Combines the chord components into the chords group
const chordsPattern =
    `(?<chords>` +
    chordQualityPattern +      // 1st quality
    chordNumberPattern +       // 1st number
    `(?:${chordQualityRequired}${chordNumberRequiredPattern})?` +  // 2nd quality+number
    `)?`

// Bass note pattern - captures the optional bass note after the slash
const bassPattern = "(?:\\/(?<bass>(?<bassNote>[A-G])(?<bassAccidentals>(?:b|bb|♭|♭♭)|(?:#|##))?))?";

// Combine all patterns into the final chord matcher
const chordMatcher = `${notePattern}${chordsPattern}${bassPattern}`

export const testHeader = (string: string) => /\[[a-zA-Z0-9\s]+/.test(string)

export const testChords = (string: string) => {
    const match = (new RegExp(noTriples + chordMatcher + '$')).exec(string)

    if (match === null || match.length === 0)
        return false
    if (match[0] === string)
        return true
}
export const testSpaces = (string: string) => /^\s*$/.test(string)

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

const matchChords = (string: string) => (new RegExp(chordMatcher).exec(string))

export const transposeChord = (chord: string, transpose: number): string => {
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

        return `${notes[transposedNoteIndex]}${matchedChords ?? ''}${bassChord}`
    }
    return chord
}

export const testTokenContext = (tokens: string[]) => {
    if (tokens[1] === '|') return false

    const normalizedTokens = tokens.filter(token => !delimiterMatcher.test(token))

    if (normalizedTokens.every(token => testChords(token)) || normalizedTokens.every(token => !testChords(token))) return false

    const tokenCount = normalizedTokens.reduce((previousValue, currentValue) => {
        if (testChords(currentValue)) {
            return {chords: previousValue.chords + 1, other: previousValue.other}
        }
        return {chords: previousValue.chords, other: previousValue.other + 1}
    }, {chords: 0, other: 0})

    if (tokenCount.chords > tokenCount.other) return false

    return true
}