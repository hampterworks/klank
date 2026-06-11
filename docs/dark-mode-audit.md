# Dark-Mode Coverage Audit

Audit of everything that did not respond to the `Light`/`Dark` theme switch, the root
causes, and the fixes applied (branch `fix/dark-mode-coverage`).

Theming model: `ThemeProvider` applies the `--klank-color-*` custom properties from
`libs/ui/src/lib/theme/theme.ts` as inline style on `<body>`. Anything that hardcodes a
color, or that falls outside the inheritance chain, ignores the theme.

## Issues found and fixed

### 1. Icons rendered black in dark mode

Almost every icon in `libs/ui/src/lib/icons/` hardcoded its color, three of them
implicitly (SVG's default `fill` is black when none is set):

| Icons | Problem |
| --- | --- |
| Chevron, File, Refresh, Settings, Target | hardcoded `stroke` (`#000000` / `#1C274C`) |
| Close, Download, Edit, Folder, Min, MoveLeft, Plus, Search, Shuffle, Stop, Theme | hardcoded `fill` (`#000000` / `#0F0F0F` / `#212121` / `#1C274C`) |
| FontSize, Speed, Transpose | no `fill` at all → implicit SVG default black |
| Play | used `var(--klank-color-text)` directly |

**Fix:** all icons now use `fill`/`stroke="currentColor"` and inherit the themed text
color from `<body>` (see issue 2). `StopIcon` also had invalid React DOM attributes
(`fill-rule`/`clip-rule` → `fillRule`/`clipRule`).

**Exception:** `LogoIcon` keeps its brand colors (`#1a1a1a`/`#fff`) on purpose and is
exempted from the regression test.

### 2. Sheet (tab) text stayed black in dark mode

Two stacked causes:

- `apps/klank/styles.css` never set a text color on `body`, so `color` everywhere fell
  back to the user-agent default (black).
- The CSS reset rule `:where(pre) { all: revert; }` reverts the Sheet's `<pre>` to
  user-agent styling, which made the symptom most visible there.

**Fix:** `body` now declares `color: var(--klank-color-text)` and
`background: var(--klank-color-background)`. `revert` on an inherited property falls
back to the inherited value, so the sheet — and every `currentColor` icon — now follows
the theme.

### 3. Native UI chrome stayed light

No `color-scheme` was ever set, so scrollbars and native form controls rendered in
light mode regardless of theme.

**Fix:** `ThemeProvider` now sets `colorScheme: 'dark' | 'light'` on `<body>` alongside
the theme variables.

### 4. Hardcoded colors in CSS modules

- `libs/ui/src/lib/incrementButton/increment.module.css` — button glyphs `fill: #040404`,
  disabled `fill: #ccc` → `var(--klank-color-text)`, disabled muted with `opacity: 0.3`.
- `libs/ui/src/lib/fileTreeView/fileTreeview.module.css` — zebra-stripe borders
  `rgba(0, 0, 0, 0.05)` were invisible on the dark background → new theme variable
  `--klank-color-divider` (light: `rgba(0,0,0,0.05)`, dark: `rgba(255,255,255,0.07)`).
- `apps/klank/app/routes/settings.module.css` — status borders `#4caf50`/`#f44336`
  → the existing `var(--klank-color-success)`/`var(--klank-color-fail)`.

## Intentionally left unchanged

- **Box shadows** (`rgba(0, 0, 0, …)`) — black shadows read correctly in both themes.
- **Modal overlay scrim** `rgba(0, 0, 0, 0.45)` — a dark scrim is correct in both themes.
- **`color: #fff` on danger buttons/toasts** — these sit on `var(--klank-color-fail)`
  (a fixed red in both themes), so white text is theme-independent.
- **`LogoIcon` brand colors** — see issue 1.

## Regression protection

- `libs/ui/src/lib/theme/theme.spec.ts` — property-based (fast-check): both themes
  define the identical key set, every key is `--klank-color-*`, every value is valid
  CSS color syntax, and WCAG contrast holds in both themes (text/background ≥ 7,
  text/secondary-background ≥ 4.5).
- `libs/ui/src/lib/icons/icons.spec.tsx` — renders every `*Icon.tsx` export (picked up
  automatically via `import.meta.glob`, so new icons are covered without editing the
  test) and fails if any `fill`/`stroke` is anything other than absent, `none`,
  `currentColor`, or `var(--klank-color-…)`. Also asserts named-exports-only.
