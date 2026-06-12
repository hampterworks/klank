import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import * as React from 'react'

// ── Glob all icon modules eagerly ─────────────────────────────────────────────
// Pattern matches *Icon.tsx — excludes this spec file (which ends in .spec.tsx)

const iconModules = import.meta.glob<Record<string, unknown>>('./*Icon.tsx', {
  eager: true,
})

// ── Helpers ───────────────────────────────────────────────────────────────────

const ALLOWED_COLOR_VALUES = new Set(['none', 'currentColor'])
const CSS_VAR_PREFIX = /^var\(--klank-color-/

function isAllowedColorValue(value: string): boolean {
  return ALLOWED_COLOR_VALUES.has(value) || CSS_VAR_PREFIX.test(value)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('icon modules', () => {
  it('glob finds a reasonable number of icons (>= 20)', () => {
    // Given: the *Icon.tsx glob over the icons directory
    // When: the matched modules are counted
    // Then: at least 20 modules are found, proving the glob works
    const moduleCount = Object.keys(iconModules).length
    expect(
      moduleCount,
      `Expected >= 20 icon modules but glob only found ${moduleCount}. Check the glob pattern.`,
    ).toBeGreaterThanOrEqual(20)
  })

  it('every icon module uses named exports only (no default export)', () => {
    // Given: each icon module loaded by the glob
    // When: the module's export keys are checked
    // Then: no module exposes a 'default' key
    for (const [filePath, mod] of Object.entries(iconModules)) {
      expect(
        'default' in mod,
        `Icon module "${filePath}" has a default export. Use a named export instead.`,
      ).toBe(false)
    }
  })

  it('every icon except LogoIcon uses only theme-aware color values on fill/stroke attributes', () => {
    // Given: each icon module excluding the documented LogoIcon brand-color exception
    // When: the rendered SVG output is inspected for fill and stroke attribute values
    // Then: all present fill/stroke values are absent, 'none', 'currentColor', or var(--klank-color-*)

    for (const [filePath, mod] of Object.entries(iconModules)) {
      // Skip the documented brand-color exception
      if (filePath.includes('LogoIcon')) continue

      // Find all named React component exports in this module
      const componentExports = Object.entries(mod).filter(
        ([, value]) => typeof value === 'function',
      ) as [string, React.FC][]

      for (const [exportName, Component] of componentExports) {
        const { container } = render(<Component />)

        const elements = Array.from(container.querySelectorAll('*'))
        for (const el of elements) {
          for (const attrName of ['fill', 'stroke'] as const) {
            const attrValue = el.getAttribute(attrName)

            // Absent attributes are allowed
            if (attrValue === null) continue

            expect(
              isAllowedColorValue(attrValue),
              `Icon "${exportName}" in "${filePath}" has a non-theme-aware ${attrName} value: "${attrValue}". ` +
                `Allowed values: absent, 'none', 'currentColor', or var(--klank-color-*).`,
            ).toBe(true)
          }
        }
      }
    }
  })
})
