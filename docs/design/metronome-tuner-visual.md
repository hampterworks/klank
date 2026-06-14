# Metronome & Tuner — Visual Design Spec

> Scope: look-and-feel only. UX flows, keyboard handling, and accessibility are covered separately.
> All color values reference `--klank-color-*` tokens from `libs/ui/src/lib/theme/theme.ts`.
> No new hardcoded color values are introduced; one new semantic token is proposed (flagged inline).

---

## 1. Icon Design

### Shared icon conventions (derived from existing set)

| Property | Value | Evidence |
|---|---|---|
| `viewBox` | `0 0 24 24` | PlayIcon, StopIcon, SettingsIcon, RefreshIcon, SearchIcon, CloseIcon |
| Default render size | `width="20px" height="20px"` | PlayIcon, StopIcon |
| Stroke icons: `fill` | `none` | PlayIcon, RefreshIcon, SettingsIcon |
| Stroke icons: `stroke` | `currentColor` | PlayIcon, RefreshIcon, SettingsIcon |
| Stroke icons: `strokeWidth` | `2` | PlayIcon, RefreshIcon |
| `strokeLinecap` | `round` | PlayIcon, RefreshIcon |
| `strokeLinejoin` | `round` | PlayIcon, RefreshIcon |
| Fill icons: `fill` | `currentColor`, no stroke | SpeedIcon, FontSizeIcon, TransposeIcon, StopIcon (fill shape) |

Both new icons should be **stroke-only** (matching PlayIcon/SettingsIcon/RefreshIcon style) because they represent abstract instrument-related concepts that read more clearly as outlines at 20 px. Fill-style icons in the existing set (SpeedIcon, TransposeIcon) are complex imported silhouettes; new purpose-built icons should follow the cleaner stroke convention.

---

### 1a. MetronomeIcon

**Concept:** Classic mechanical metronome — a tall isosceles triangle (the body) with a vertical center staff and a small diamond pendulum weight partway up the staff, angled to one side to imply motion.

**SVG approach:**

```svg
<svg
  viewBox="0 0 24 24"
  width="20px"
  height="20px"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Trapezoidal body: wide base, narrower top -->
  <path
    d="M5 20 L12 4 L19 20 Z"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  />
  <!-- Flat base line (bottom of body, slightly inset) -->
  <line
    x1="5" y1="20" x2="19" y2="20"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
  <!-- Center vertical staff from apex down -->
  <line
    x1="12" y1="4" x2="12" y2="19"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  />
  <!-- Pendulum arm angled right — implies a mid-swing position -->
  <line
    x1="12" y1="11" x2="16" y2="7"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
  <!-- Pendulum weight: small filled circle at the tip of the arm -->
  <circle
    cx="16" cy="7" r="1.5"
    fill="currentColor"
  />
</svg>
```

**Notes:**
- The pendulum arm is angled to the right at approximately 45 degrees. This is a static snapshot; animation (if any) lives in CSS, not the SVG.
- The small filled circle (weight) is the only `fill="currentColor"` element; this accent is intentional and mirrors the way StopIcon uses a filled shape for emphasis.
- At 20 px the triangle reads instantly as a metronome even without the label.

---

### 1b. TuningForkIcon

**Concept:** A tuning fork viewed face-on — a straight handle with two curved tines branching from the top, like a U shape elevated above the stem.

**SVG approach:**

```svg
<svg
  viewBox="0 0 24 24"
  width="20px"
  height="20px"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Handle / stem: vertical line from bottom center up to mid-body -->
  <line
    x1="12" y1="22" x2="12" y2="13"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  />
  <!-- Left tine: curves up and out from the stem junction -->
  <path
    d="M12 13 C12 13 8 13 8 9 C8 5 12 4 12 4"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
  <!-- Right tine: mirror of left -->
  <path
    d="M12 13 C12 13 16 13 16 9 C16 5 12 4 12 4"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
</svg>
```

**Notes:**
- The two cubic Bezier paths share endpoints at `12,4` (top of tines) and `12,13` (junction with handle), forming a closed U silhouette without using `fill`.
- The arc tightness (control points at y=9 and y=13) keeps the U readable at 20 px without overcrowding the 24-unit canvas.
- No filled elements — pure stroke, matching PlayIcon/RefreshIcon convention.

---

## 2. Popover Panel Visual Treatment

Both the metronome and tuner appear as popover panels anchored below their toolbar trigger buttons. They share identical panel chrome so they read as siblings.

### Surface and border

```
background:    var(--klank-color-background)
border:        1px solid var(--klank-color-border)
border-radius: 6px
```

Rationale: `--klank-color-background` matches the tooltip surface (see `toolTip.module.css`) and the sheet toolbar background, so the popover sits in the same material layer as those elements rather than floating on a contrasting card. `border-radius: 6px` is one step up from the `4px` used on buttons and the IncrementButton container — enough to visually distinguish the popover as a larger surface without introducing a new scale step.

### Shadow

```
box-shadow: 0 4px 12px var(--klank-color-divider),
            0 1px 3px var(--klank-color-divider)
```

`--klank-color-divider` is already a semi-transparent rgba value in both themes (`rgba(0,0,0,0.05)` Light / `rgba(255,255,255,0.07)` Dark). Layering two shadow stops — a larger diffuse one and a tight contact shadow — gives enough depth to lift the popover off the page without introducing any hardcoded rgba.

At the default token values the shadow is intentionally subtle. If it reads as insufficient during implementation, multiply the alpha by stacking a third stop rather than introducing a new hardcoded value.

### Padding and spacing

```
panel padding:          16px
section internal gap:   12px
row gap (label + ctrl): 8px
```

These map to the spacing steps already in use: `16px` matches Button `.container` padding; `8px` matches the gap in IncrementButton `.container` and the sheetToolbar `.controls` gap; `12px` fills the intermediate step.

### Typography

All text inside panels is `var(--klank-color-text)`.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Section label / panel title | `0.6875rem` (11 px) | `700` | Matches the `playlistCounter` all-small-caps label style in sheetToolbar |
| Value readout (BPM number, cents offset) | `1.25rem` (20 px) | `700` | Large enough to read at a glance without a label; no equivalent in existing UI — justified by primary-data role |
| Secondary value / note name | `0.875rem` (14 px) | `400` | Matches tooltip font-size and sheetToolbar `.songName` size |
| Button / control label | `0.75rem` (12 px) | `700`, `font-variant: all-small-caps` | Matches sheetToolbar `.actionButtons` |

No new font sizes are introduced except `1.25rem` for primary readouts. If the team decides this is out of range, `1rem` is the fallback — still larger than the existing 14 px body text to give hierarchy.

### Width

```
min-width: 220px
max-width: 280px
```

Wide enough to hold BPM controls or six string buttons in a row without wrapping, narrow enough to stay anchored near the toolbar icon without covering tab content.

---

## 3a. Metronome Beat Indicator

The beat indicator lives inside the metronome popover, below the BPM control row. It shows the current beat position in the current bar (default 4/4).

### Dot row

Four dots in a horizontal row, evenly spaced (`gap: 10px`). Each dot:

```
width:  10px
height: 10px
border-radius: 50%
```

**Inactive beat dot (default state):**
```
background: var(--klank-color-secondary-background)
border: 1px solid var(--klank-color-border)
```

**Active beat dot (currently sounding beat):**
```
background: var(--klank-color-text)
border: 1px solid var(--klank-color-text)
```

A hard color switch (no border, background snaps from secondary-background to text-color) gives the tactile, mechanical feel of a metronome tick rather than a soft glow. It also avoids the need for any color not already in the token set.

**Downbeat (beat 1) — accent styling:**

The first dot is slightly larger and uses `--klank-color-success` when active:

```
/* Downbeat dot — always */
width:  14px
height: 14px

/* Downbeat dot — inactive */
background: var(--klank-color-secondary-background)
border: 1px solid var(--klank-color-success)

/* Downbeat dot — active */
background: var(--klank-color-success)
border: 1px solid var(--klank-color-success)
```

`--klank-color-success` (#36b15d, same in both themes) is the only non-neutral color in the token set and is already semantically charged as "go / active / correct" from other usage. Applying it to the downbeat accent is consistent with that meaning and creates an immediately recognizable visual hierarchy.

### Pulse animation

When the metronome is running, the active dot receives a brief scale pulse on tick via a CSS keyframe:

```css
@keyframes klank-beat-pulse {
  0%   { transform: scale(1.3); }
  40%  { transform: scale(1);   }
  100% { transform: scale(1);   }
}
```

Duration: tied to the current BPM in JS (`60000 / bpm` ms), applied as an inline `animation-duration`. The animation plays once per tick (`animation-iteration-count: 1`, `animation-fill-mode: none`). Re-triggering is achieved by removing and re-adding the class between ticks rather than using `animation-play-state`, which avoids timing drift.

The downbeat accent dot uses the same keyframe but with a slightly larger starting scale (`1.5`) set via a CSS custom property override on the element.

### Tempo tap button

A "Tap" button uses the standard `Button` component in icon-button mode (`.iconContainer` class). No extra styling needed beyond what the component already provides. Place it to the right of the BPM IncrementButton row.

---

## 3b. Tuner Per-String Buttons

The tuner shows one button per string (6 for standard guitar, 4 for bass, etc.). Buttons are arranged in a single row when 6 or fewer strings are present; they wrap to two rows beyond that.

### Default (not currently sounding)

Use the existing `Button` component in default mode:
```
background: var(--klank-color-secondary-background)
border-radius: 4px
padding: 8px 12px
font-size: 0.75rem
font-weight: 700
font-variant: all-small-caps
color: var(--klank-color-text)
```

Label: the open string note name (E, A, D, G, B, e).

### Active / sounding state

When the tuner is actively listening to a string, that string's button should read as selected without relying solely on color (to support color-blind users — noted here even though accessibility is out of scope for this doc, because the choice of indicator directly affects the visual design).

```
background: var(--klank-color-highlight)
border: 1px solid var(--klank-color-text)
```

This is a modest step up from the hover state (`.container:hover` already uses `--klank-color-highlight`) and adds an explicit border to signal "this is the selected item." The border uses `--klank-color-text` rather than `--klank-color-border` because at small sizes the border needs to be high-contrast to be distinguishable.

### In-tune / out-of-tune indication on the active string button

A thin colored bar across the bottom of the active string button signals tuning accuracy. This keeps the button shape intact while adding a precise status indicator:

```
/* Shared: 3px bar, inset at the bottom of the button, full width */
position: absolute; bottom: 0; left: 0; right: 0;
height: 3px;
border-radius: 0 0 4px 4px;
```

Color mapping:
- More than ~10 cents flat or sharp: `var(--klank-color-fail)` (#b13636)
- Within ~5 cents: `var(--klank-color-success)` (#36b15d)
- Between 5–10 cents: **no intermediate token exists**. Two options: (a) omit the middle state and use only fail/success with a wider tolerance threshold; (b) introduce a new token `--klank-color-warning` (suggested value: `#c98a1a` Light / `#d9a03a` Dark). Option (a) is recommended to avoid a new token unless product decides the intermediate state is critical.

The button's `position` must be set to `relative` to contain the absolute bar.

### Cents readout

A single large numeric readout (e.g. `+3` or `-7`) appears centrally in the tuner panel above the string buttons, in the primary readout typography (`1.25rem`, `700`). A `+` or `-` prefix disambiguates direction. Color follows the same fail/success token logic as the bar. When no input is detected the readout shows `—` in `--klank-color-text` at reduced opacity (`opacity: 0.35`).

---

## 4. Consistency Notes

### What binds both panels to the existing product

- **Same surface material:** `--klank-color-background` with a `--klank-color-border` 1 px border is exactly what the tooltip uses and what the sheet toolbar sits on. The panels don't feel like foreign cards; they feel like extensions of the chrome already surrounding the tab.

- **Same control vocabulary:** BPM adjustment uses an `IncrementButton` with the `SpeedIcon` convention (an icon to the left of minus/value/plus). The tuner uses `Button` in its existing small variant. No new control patterns are introduced.

- **Spacing from the same grid:** 4 / 8 / 12 / 16 px are already the rhythm of the app (gap values in sheetToolbar, IncrementButton, button padding). Both panels stay within this grid.

- **Icons in the same stroke language:** MetronomeIcon and TuningForkIcon use `viewBox="0 0 24 24"`, `strokeWidth="2"`, `strokeLinecap="round"`, `strokeLinejoin="round"`, `fill="none"`, `currentColor` — identical parameters to PlayIcon and RefreshIcon. They will be visually indistinguishable in origin from the existing icon set.

- **Color usage that doesn't invent:** Success green (`--klank-color-success`) already means "go / active / correct" in the codebase. Using it for the downbeat accent and the in-tune indicator reinforces that existing meaning rather than overloading a different hue.

- **No new tokens required** unless the tuner's intermediate "close but not in-tune" state is considered a first-class product concept. If it is, propose `--klank-color-warning` to the theme; if not, the binary fail/success model works with zero new tokens.

### What to watch during implementation

- The popover's `border-radius: 6px` is intentionally one step above the `4px` used on buttons. If this creates visual inconsistency at the point where the popover anchors directly below a button, consider matching them at `4px`.
- The `1.25rem` primary readout size has no precedent in the existing stylesheet. Verify it doesn't feel oversized relative to the 34 px toolbar height when the popover is anchored there.
- Beat dot pulse animation durations at very high BPM (>200) will be under 300 ms. At those speeds the scale effect becomes noise rather than feedback; consider disabling the animation above a threshold (e.g. 180 BPM) and relying solely on the color switch.
