import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { reorder } from '../app/components/menu/PlaylistSection'

const nonEmptyArrayArb = <T>(arb: fc.Arbitrary<T>) =>
  fc.array(arb, { minLength: 1, maxLength: 20 })

const indexPairArb = (len: number) =>
  fc.tuple(
    fc.integer({ min: 0, max: len - 1 }),
    fc.integer({ min: 0, max: len - 1 }),
  )

describe('reorder — property-based', () => {
  it('result has the same length as input', () => {
    fc.assert(fc.property(nonEmptyArrayArb(fc.string()), (arr) => {
      const [from, to] = [0, arr.length - 1]
      expect(reorder(arr, from, to)).toHaveLength(arr.length)
    }))
  })

  it('result contains the same elements (is a permutation)', () => {
    fc.assert(fc.property(nonEmptyArrayArb(fc.string()), (arr) => {
      return fc.assert(fc.property(indexPairArb(arr.length), ([from, to]) => {
        const result = reorder(arr, from, to)
        expect([...result].sort()).toEqual([...arr].sort())
      }))
    }))
  })

  it('item at "from" lands at "to"', () => {
    fc.assert(fc.property(nonEmptyArrayArb(fc.string()), (arr) => {
      return fc.assert(fc.property(indexPairArb(arr.length), ([from, to]) => {
        const item = arr[from]
        const result = reorder(arr, from, to)
        expect(result[to]).toBe(item)
      }))
    }))
  })

  it('does not mutate the original array', () => {
    fc.assert(fc.property(nonEmptyArrayArb(fc.string()), (arr) => {
      const copy = [...arr]
      reorder(arr, 0, arr.length - 1)
      expect(arr).toEqual(copy)
    }))
  })

  it('from === to leaves the array unchanged', () => {
    fc.assert(fc.property(nonEmptyArrayArb(fc.string()), (arr) => {
      return fc.assert(fc.property(fc.integer({ min: 0, max: arr.length - 1 }), (idx) => {
        expect(reorder(arr, idx, idx)).toEqual(arr)
      }))
    }))
  })

  it('dragging down: item lands before the hovered row (insertAt = hoverIndex - 1)', () => {
    // Use arr = [0,1,2,...,len-1] so each value is unique and equals its original index.
    // Mirrors the UI fix: when from < hoverIndex the caller passes hoverIndex-1 as insertAt.
    fc.assert(fc.property(fc.integer({ min: 3, max: 20 }), (len) => {
      const arr = Array.from({ length: len }, (_, i) => i)
      return fc.assert(fc.property(
        fc.integer({ min: 0, max: len - 2 }),
        fc.integer({ min: 1, max: len - 1 }),
        (from, hoverIndex) => {
          fc.pre(from < hoverIndex)
          const insertAt = hoverIndex - 1
          const result = reorder(arr, from, insertAt)
          // arr[i] === i, so result.indexOf(from) finds where the dragged item ended up
          const draggedPos = result.indexOf(from)
          const hoveredPos = result.indexOf(hoverIndex)
          expect(draggedPos).toBeLessThan(hoveredPos)
        }
      ))
    }))
  })

  it('dragging up: item lands before the hovered row (insertAt = hoverIndex)', () => {
    fc.assert(fc.property(fc.integer({ min: 3, max: 20 }), (len) => {
      const arr = Array.from({ length: len }, (_, i) => i)
      return fc.assert(fc.property(
        fc.integer({ min: 1, max: len - 1 }),
        fc.integer({ min: 0, max: len - 2 }),
        (from, hoverIndex) => {
          fc.pre(from > hoverIndex)
          const result = reorder(arr, from, hoverIndex)
          const draggedPos = result.indexOf(from)
          const hoveredPos = result.indexOf(hoverIndex)
          expect(draggedPos).toBeLessThan(hoveredPos)
        }
      ))
    }))
  })
})
