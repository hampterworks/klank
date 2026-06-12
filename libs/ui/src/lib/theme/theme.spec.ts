import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { getThemeVariables } from './theme.js'
import type { Theme } from './theme.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse a hex color (#rrggbb) into [r, g, b] each in 0-1. */
function hexToLinear(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const linearise = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return [linearise(r), linearise(g), linearise(b)]
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** CSS color value regex patterns */
const hexPattern = /^#[0-9a-fA-F]{6}$/
const rgbaPattern =
  /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/

function isValidCssColor(value: string): boolean {
  if (hexPattern.test(value)) return true
  const m = rgbaPattern.exec(value)
  if (!m) return false
  const [, r, g, b] = m
  return [r, g, b].every((ch) => parseInt(ch, 10) <= 255)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

const themes: Theme[] = ['Light', 'Dark']
const themeArb = fc.constantFrom<Theme>(...themes)

describe('getThemeVariables', () => {
  it('default argument equals Light theme', () => {
    // Given: no argument is passed
    // When: getThemeVariables() is called
    // Then: it returns the same object as getThemeVariables('Light')
    expect(getThemeVariables()).toEqual(getThemeVariables('Light'))
  })

  it('Light and Dark define exactly the same set of variable keys', () => {
    // Given: both themes are requested
    // When: their key sets are compared
    // Then: sorted keys are identical
    fc.assert(
      fc.property(
        fc.constant(null),
        () => {
          const lightKeys = Object.keys(getThemeVariables('Light')).sort()
          const darkKeys = Object.keys(getThemeVariables('Dark')).sort()
          expect(lightKeys).toEqual(darkKeys)
        },
      ),
    )
  })

  it('all keys start with --klank-color- for any theme', () => {
    // Given: any theme value
    // When: all keys of the returned record are inspected
    // Then: every key begins with --klank-color-
    fc.assert(
      fc.property(themeArb, (theme) => {
        const vars = getThemeVariables(theme)
        for (const key of Object.keys(vars)) {
          expect(key).toMatch(/^--klank-color-/)
        }
      }),
    )
  })

  it('all values are valid CSS colors for any theme and any key', () => {
    // Given: any theme value
    // When: all values of the returned record are inspected
    // Then: each value matches #rrggbb or rgba(r, g, b, a) with valid component ranges
    fc.assert(
      fc.property(themeArb, (theme) => {
        const vars = getThemeVariables(theme)
        for (const [key, value] of Object.entries(vars)) {
          expect(
            isValidCssColor(String(value)),
            `${theme} key "${key}" has invalid CSS color value: "${String(value)}"`,
          ).toBe(true)
        }
      }),
    )
  })

  it('WCAG AAA: text/background contrast >= 7 for both themes', () => {
    // Given: the text and background colors for each theme
    // When: contrast ratio is computed
    // Then: it meets the WCAG AAA threshold of 7:1
    for (const theme of themes) {
      const vars = getThemeVariables(theme)
      const text = String(vars['--klank-color-text'])
      const bg = String(vars['--klank-color-background'])

      expect(
        hexPattern.test(text),
        `${theme} --klank-color-text ("${text}") must be a hex color for contrast check`,
      ).toBe(true)
      expect(
        hexPattern.test(bg),
        `${theme} --klank-color-background ("${bg}") must be a hex color for contrast check`,
      ).toBe(true)

      const ratio = contrastRatio(text, bg)
      expect(
        ratio,
        `${theme} text/background contrast ratio ${ratio.toFixed(2)} does not meet WCAG AAA (>= 7)`,
      ).toBeGreaterThanOrEqual(7)
    }
  })

  it('WCAG AA: text/secondary-background contrast >= 4.5 for both themes', () => {
    // Given: the text and secondary-background colors for each theme
    // When: contrast ratio is computed
    // Then: it meets the WCAG AA threshold of 4.5:1
    for (const theme of themes) {
      const vars = getThemeVariables(theme)
      const text = String(vars['--klank-color-text'])
      const secondaryBg = String(vars['--klank-color-secondary-background'])

      expect(
        hexPattern.test(text),
        `${theme} --klank-color-text ("${text}") must be a hex color for contrast check`,
      ).toBe(true)
      expect(
        hexPattern.test(secondaryBg),
        `${theme} --klank-color-secondary-background ("${secondaryBg}") must be a hex color for contrast check`,
      ).toBe(true)

      const ratio = contrastRatio(text, secondaryBg)
      expect(
        ratio,
        `${theme} text/secondary-background contrast ratio ${ratio.toFixed(2)} does not meet WCAG AA (>= 4.5)`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})
