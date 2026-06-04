import { sortByArtist } from './sort.js'
import { FileEntry } from './fs.js'

const fixtures: FileEntry[] = [
  {
    name: 'Radiohead - Creep.tab.txt',
    path: '/tabs/Radiohead - Creep.tab.txt',
    artist: 'Radiohead',
    song: 'Creep',
  },
  {
    name: 'Radiohead - Karma Police.tab.txt',
    path: '/tabs/Radiohead - Karma Police.tab.txt',
    artist: 'Radiohead',
    song: 'Karma Police',
  },
  {
    name: 'Beatles - Hey Jude.tab.txt',
    path: '/tabs/Beatles - Hey Jude.tab.txt',
    artist: 'Beatles',
    song: 'Hey Jude',
  },
  {
    name: 'beatles - Let It Be.tab.txt',
    path: '/tabs/beatles - Let It Be.tab.txt',
    artist: 'beatles',
    song: 'Let It Be',
  },
  {
    name: 'Unknown.tab.txt',
    path: '/tabs/Unknown.tab.txt',
    artist: 'Unknown',
    song: undefined,
  },
]

describe('sortByArtist', () => {
  describe('without a search filter', () => {
    it('groups files by artist using lowercase keys', () => {
      // Given the fixture file list with mixed-case artist names
      // When sortByArtist is called without a filter
      // Then each artist bucket uses a lowercase key
      const result = sortByArtist(fixtures)
      expect(result).toHaveProperty('radiohead')
      expect(result).toHaveProperty('beatles')
    })

    it('places both Beatles entries under the same lowercase key', () => {
      // Given two entries with artist "Beatles" and "beatles" (case differs)
      // When sortByArtist is called
      // Then both land in the same "beatles" bucket because the key is lowercased
      const result = sortByArtist(fixtures)
      expect(result['beatles']).toHaveLength(2)
    })

    it('places both Radiohead entries under the radiohead key', () => {
      const result = sortByArtist(fixtures)
      expect(result['radiohead']).toHaveLength(2)
    })

    it('returns all entries present across all buckets', () => {
      // Given five fixture entries
      // When sortByArtist is called without a filter
      // Then the total count across all buckets equals 5
      const result = sortByArtist(fixtures)
      const total = Object.values(result).flat().length
      expect(total).toBe(5)
    })

    it('returns keys in alphabetical order with unknown last', () => {
      // Given a mix of artist names including an unknown entry
      // When sortByArtist is called
      // Then keys are sorted alphabetically and "unknown" is sorted to the end
      const result = sortByArtist(fixtures)
      const keys = Object.keys(result)
      const unknownIndex = keys.indexOf('unknown')
      expect(unknownIndex).toBe(keys.length - 1)
      const nonUnknownKeys = keys.filter((k) => k !== 'unknown')
      expect(nonUnknownKeys).toEqual([...nonUnknownKeys].sort())
    })

    it('places "beatles" before "radiohead" alphabetically', () => {
      const result = sortByArtist(fixtures)
      const keys = Object.keys(result)
      expect(keys.indexOf('beatles')).toBeLessThan(keys.indexOf('radiohead'))
    })

    it('sends entries with no song to the unknown bucket', () => {
      // Given one entry with song: undefined and artist: 'Unknown'
      // When sortByArtist is called
      // Then that entry appears in the "unknown" bucket
      const result = sortByArtist(fixtures)
      expect(result['unknown']).toBeDefined()
      expect(result['unknown'].some((e: FileEntry) => e.name === 'Unknown.tab.txt')).toBe(true)
    })
  })

  describe('with a search filter', () => {
    it('returns only entries whose name contains the filter string (case-insensitive)', () => {
      // Given a filter of "radio"
      // When sortByArtist is called with that filter
      // Then only Radiohead entries appear in the result
      const result = sortByArtist(fixtures, 'radio')
      expect(result).toHaveProperty('radiohead')
      expect(result['radiohead']).toHaveLength(2)
    })

    it('excludes artists whose names do not match the filter', () => {
      const result = sortByArtist(fixtures, 'radio')
      expect(result).not.toHaveProperty('beatles')
      expect(result).not.toHaveProperty('unknown')
    })

    it('returns an empty object when no entries match the filter', () => {
      // Given a filter that matches nothing
      // When sortByArtist is called
      // Then the result is an empty object
      const result = sortByArtist(fixtures, 'xyz')
      expect(Object.keys(result)).toHaveLength(0)
    })

    it('is case-insensitive for the filter string', () => {
      // Given the filter "RADIO" in uppercase
      // When sortByArtist is called
      // Then Radiohead entries are still matched
      const result = sortByArtist(fixtures, 'RADIO')
      expect(result).toHaveProperty('radiohead')
    })
  })

  describe('edge cases', () => {
    it('returns an empty object when given an empty file list', () => {
      // Given no files
      // When sortByArtist is called
      // Then the result is an empty object
      const result = sortByArtist([])
      expect(result).toEqual({})
    })

    it('handles a single file with a song correctly', () => {
      // Given one entry with a known artist and song
      // When sortByArtist is called
      // Then that entry appears under its artist key
      const single: FileEntry[] = [
        { name: 'Nirvana - Come As You Are', path: '/tabs/nirvana.tab.txt', artist: 'Nirvana', song: 'Come As You Are' },
      ]
      const result = sortByArtist(single)
      expect(result['nirvana']).toHaveLength(1)
    })

    it('handles a single file with no song by placing it under unknown', () => {
      // Given one entry with song: undefined
      // When sortByArtist is called
      // Then that entry appears under the "unknown" key
      const single: FileEntry[] = [
        { name: 'Mystery', path: '/tabs/mystery.tab.txt', artist: 'Mystery', song: undefined },
      ]
      const result = sortByArtist(single)
      expect(result['unknown']).toHaveLength(1)
    })
  })
})
