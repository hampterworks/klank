# Metronome and Tuner UX Spec

Status: Ready for implementation
Last updated: 2026-06-14

---

## 1. Toolbar Placement

### 1.1 Current toolbar anatomy (desktop, left to right)

```
[playlist-prev | counter | playlist-next]  [song-name ...................]  [font-size]  [transpose]  [scroll-speed]  |  [play/stop]  [edit/save]
```

The `.controls` group is `flex-shrink: 0` and lives to the right of `.songName`. Within `.controls`, the three `IncrementButton` widgets are separated by a final `border-left` divider that wraps `[play/stop] [edit/save]` (`.actionButtons`).

### 1.2 New button positions

Add a second button-group divider section called `.toolButtons` inserted between the last `IncrementButton` and `.actionButtons`:

```
[font-size]  [transpose]  [scroll-speed]  |  [metronome]  [tuner]  |  [play/stop]  [edit/save]
```

Rendering rules:
- `.toolButtons` uses the same `border-left: 1px solid var(--klank-color-border)` and `padding-left: 0.5rem` treatment as `.actionButtons`.
- Both buttons use the existing `Button` component with `iconButton={true}` — icon only, no visible label, matching the `iconContainer` CSS class (padding 4px 8px, hover scale 1.1).
- Both buttons get 24x24 px SVG icons at 16x16 px effective size (matching the icon scale used elsewhere in the toolbar).
- Both buttons are wrapped in `ToolTip` with messages `"Metronome (M)"` and `"Tuner (T)"` respectively. The shortcut hint in the tooltip text is a UX affordance only; it does not require special rendering.
- When a panel is open, its trigger button receives the CSS class `.activeButton` (background `var(--klank-color-highlight)`), exactly as the Edit button does when editing.
- Only one panel may be open at a time. Opening the metronome closes the tuner and vice versa.

### 1.3 Icon specification

**MetronomeIcon** — a pendulum wedge:
- Viewbox 16x16. A vertical staff (1.5px stroke) from (8,14) to (8,2). A pendulum arm (1.5px stroke) from (8,14) angling to (12,4). A small filled circle (r=1.5) at the pivot point (8,14). A small filled circle (r=1.5) at the bob (12,4).

**TunerIcon** — a dial with a needle:
- Viewbox 16x16. A semicircle arc (1.5px stroke, bottom-open) centered at (8,12) with radius 6. Five tick marks radiating from center at -90, -45, 0, +45, +90 degrees (2px long). A needle line (1.5px stroke) from (8,12) pointing straight up to (8,6).

Both icons should use `currentColor` for all strokes and fills so they inherit `var(--klank-color-text)` from the button.

### 1.4 Mobile behavior (max-width: 599px)

At narrow widths the toolbar stacks: song name on one full-width line, controls on a second horizontally-scrollable line. The `.toolButtons` group scrolls with the rest of `.controls` — no special treatment needed. The popovers open anchored below the toolbar (see Section 2).

At widths below 400px, if horizontal space becomes critically tight, the two tool buttons may be collapsed behind a single `[tools]` icon-button that reveals a small inline strip of [metronome | tuner] on tap. This is an optional enhancement; the baseline spec keeps them as separate buttons.

---

## 2. Popover Behavior

### 2.1 Component structure

Each popover is a new component in `libs/ui/src/lib/`:
- `metronomePanel/MetronomePanel.tsx` + `metronomePanel.module.css`
- `tunerPanel/TunerPanel.tsx` + `tunerPanel.module.css`

Both are rendered via `ReactDOM.createPortal` into `document.body`, following the pattern established by `ChordDiagramTooltip`. This prevents clipping by any ancestor with `overflow: hidden` or `z-index` stacking contexts.

### 2.2 Trigger

Clicking the metronome or tuner toolbar button toggles that panel open/closed. A second click on the same button closes it. Opening one panel while the other is open closes the other first (the outgoing panel stops the metronome or mutes the tuner audio).

### 2.3 Positioning

On open, the panel reads the trigger button's bounding rect via `getBoundingClientRect()` and positions itself as follows:

**Desktop (width > 599px):**
- `top = buttonRect.bottom + 6` (6px gap below toolbar, keeping tab text visible)
- `right = window.innerWidth - buttonRect.right` (aligns panel's right edge with button's right edge)
- If `top + panelHeight > window.innerHeight - 16`, flip to open upward: `bottom = window.innerHeight - buttonRect.top + 6`

**Mobile (width <= 599px):**
- The toolbar is at the bottom of the screen (`order: 2`, `border-top`).
- `bottom = window.innerHeight - buttonRect.top + 6`
- `left = max(8px, buttonRect.left)`
- Panels cap at `calc(100vw - 16px)` width to stay within the viewport.

Positioning is recalculated on every open. The panel does not reposition on scroll — it stays fixed while open (using `position: fixed`).

### 2.4 Sizing

- Metronome panel: 280px wide, height auto (max ~320px).
- Tuner panel: 260px wide, height auto (max ~280px).
- On screens narrower than 320px both panels set `width: calc(100vw - 16px)`.

### 2.5 Dismiss

Three mechanisms, all must be implemented:

1. **Click outside** — `mousedown` listener on `document`. If the event target is not within the panel element or the trigger button element, close the panel. (Same pattern as `ChordDiagramTooltip`.)
2. **Esc key** — global `keydown` listener while panel is open. `e.key === 'Escape'` closes panel and returns focus to the trigger button.
3. **Trigger button re-click** — described in 2.2.

Closing the metronome panel stops the metronome beat (audio output ceases). Closing the tuner panel stops the currently ringing string tone.

### 2.6 Focus management

On open: move focus to the first interactive element inside the panel (metronome: the Start/Stop button; tuner: the first string button for E2/E4).

On close: return focus to the trigger button that opened the panel.

Focus trap while open: Tab and Shift+Tab cycle only among focusable elements within the panel. When focus would leave the last element, it wraps to the first; when it would leave the first, it wraps to the last. Implement with a `useFocusTrap` hook that queries `querySelectorAll('button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])')` within the panel `ref`.

### 2.7 Panel visual style

```
background: var(--klank-color-background)
border: 1px solid var(--klank-color-border)
border-radius: 6px
box-shadow: 0 4px 16px rgba(0,0,0,0.15)  /* light mode */
            0 4px 16px rgba(0,0,0,0.5)   /* dark mode via @media prefers-color-scheme */
padding: 12px
z-index: 1100  /* above ToolTip z-index of 1000 */
```

Panel header: a single line with the panel title ("Metronome" or "Tuner") in `font-size: 0.75rem; font-weight: 700; font-variant: all-small-caps; opacity: 0.6` plus a close button (`CloseIcon`, 16x16) floated to the right with `aria-label="Close metronome panel"`.

---

## 3. Metronome Panel

### 3.1 Visual hierarchy and layout

The panel is organized into three stacked sections separated by `border-top: 1px solid var(--klank-color-divider)`:

```
┌─────────────────────────────────┐
│ METRONOME                   [x] │  ← panel header (12px bottom margin)
├─────────────────────────────────┤
│  [−]  120  [+]   BPM            │  ← BPM row
│  [      TAP TEMPO       ]       │  ← tap-tempo button
├─────────────────────────────────┤
│  Time sig   [4] / [4]           │  ← time signature row
│  Accent     [on] [off]          │  ← accented downbeat toggle
│  Subdivide  [♩] [♪] [♪♪♪]      │  ← subdivision selector
├─────────────────────────────────┤
│  [         START        ]       │  ← start/stop, full width
└─────────────────────────────────┘
```

### 3.2 BPM row

- Renders `IncrementButton` semantics but restyled: the decrement and increment buttons are 28px wide, the value display is 48px wide showing the integer BPM, `font-size: 1rem; font-weight: 700`.
- BPM range: 20–300. Clamped, buttons disabled at bounds.
- Label "BPM" sits to the right of the increment control, `font-size: 0.6875rem; opacity: 0.6`.
- The BPM value is local React state (`useState(120)`). It is not persisted to `klank-storage`.

### 3.3 Tap Tempo button

- Full-width `<button>` with label "Tap Tempo", height 28px.
- Background: `var(--klank-color-secondary-background)`, border-radius 4px.
- On each tap, record `performance.now()`. After 2 or more taps within 3 seconds of each other, compute the average interval of the last 4 taps (or all if fewer) and set BPM to `Math.round(60000 / avgInterval)`, clamped to 20–300.
- If more than 3 seconds elapse since the last tap, the next tap resets the sequence.
- While tap sequence is active (2+ taps in), display the computed BPM immediately in the BPM display.

### 3.4 Time signature row

- "Numerator" (beats per bar): `<select>` with options 1–12, default 4. Width 48px.
- A "/" divider label.
- "Denominator" (note value): `<select>` with options 2, 4, 8, 16, default 4. Width 48px.
- Row label "Time sig" at `font-size: 0.6875rem; opacity: 0.6` on the left.

### 3.5 Accent downbeat toggle

- Label "Accent" on the left.
- Two side-by-side `<button>` elements: "On" and "Off". The active choice has background `var(--klank-color-highlight)` and `font-weight: 700`. Default: On.
- When accent is On, beat 1 of each bar plays the high-pitch accent click (880 Hz, 40ms); other beats play the standard click (440 Hz, 30ms). When Off, all beats play the same standard click.
- Both buttons use `role="radio"` and are wrapped in a `role="radiogroup"` `<div>`.

### 3.6 Subdivision selector

- Label "Subdivide" on the left.
- Three `<button>` elements acting as a single-select toggle (same radio pattern as accent):
  - Quarter note (♩) — one click per beat, label "1" for screen readers (`aria-label="Quarter notes"`)
  - Eighth note (♪) — two clicks per beat, label "2" (`aria-label="Eighth notes"`)
  - Triplet (♪♪♪) — three clicks per beat, label "3" (`aria-label="Triplets"`)
- Default: Quarter note.
- Subdivision clicks are softer — use a distinct tone: 330 Hz, 20ms, gain 0.4 (vs beat gain 0.8).

### 3.7 Start/Stop button

- Full-width, height 32px, `font-weight: 700; font-variant: all-small-caps`.
- When stopped: background `var(--klank-color-secondary-background)`, label "Start".
- When running: background `var(--klank-color-highlight)`, label "Stop".
- `aria-label` changes to "Start metronome" / "Stop metronome".
- Starting the metronome begins audio playback using the Web Audio API `AudioContext`. A new `AudioContext` is created on first start (deferred to satisfy browser autoplay policy). The `AudioContext` is stored in a `useRef` and reused for subsequent starts.

### 3.8 Audio implementation notes (for the engineer)

Use `AudioContext.createOscillator()` (type `'square'`, brief envelope via `GainNode`). Schedule beats ahead of time with `AudioContext.currentTime + lookahead` (lookahead = 25ms, schedule interval = 100ms) in a `setInterval`. This is the standard "audio worker" metronome pattern and avoids drift from `setTimeout` alone. Stop by cancelling the interval and calling `oscillator.stop()` on any currently scheduled nodes.

### 3.9 Reduced motion

The metronome panel contains no animation. The visual-only pendulum swing animation described in the icon spec (Section 1.3) MUST be suppressed when `prefers-reduced-motion: reduce` is set — apply `animation: none !important` via a media query. If an animated pendulum indicator is added in a future iteration, it must respect this constraint.

---

## 4. Tuner Panel

### 4.1 Visual hierarchy and layout

```
┌──────────────────────────────┐
│ TUNER                    [x] │  ← panel header
├──────────────────────────────┤
│ Instrument  [Guitar] [Bass]  │  ← instrument toggle
│ Tuning      [Standard ▾]     │  ← tuning select
├──────────────────────────────┤
│  [E2]  [A2]  [D3]  [G3]     │  ← string buttons (bass 4-string example)
│  [B3]  [E4]                  │  ← (guitar adds B, high-E)
├──────────────────────────────┤
│  Currently sounding: E4      │  ← status line (hidden when silent)
└──────────────────────────────┘
```

### 4.2 Instrument toggle

- Two buttons: "Guitar" and "Bass", acting as a radiogroup.
- Default: reads `instrument` from the klank store (`useKlankStore().instrument`) so it matches the user's active chord-diagram instrument setting. The panel reflects but does not write back to the store; the store's `instrument` field is for chord diagrams and must not be overridden by the tuner without explicit user intent.
- On switch: update local panel state, re-derive string layout from the selected tuning.

### 4.3 Tuning selector

A `<select>` element with `aria-label="Tuning"`. Width: fill available space minus instrument toggle width.

Guitar tunings:
- "Standard" — E2 A2 D3 G3 B3 E4
- "Drop D" — D2 A2 D3 G3 B3 E4
- "Half-step down" — Eb2 Ab2 Db3 Gb3 Bb3 Eb4
- "Open G" — D2 G2 D3 G3 B3 D4

Bass tunings (4-string):
- "Standard" — E1 A1 D2 G2
- "Drop D" — D1 A1 D2 G2
- "Half-step down" — Eb1 Ab1 Db2 Gb2
- "5-string (add B0)" — B0 E1 A1 D2 G2

When "5-string (add B0)" is selected, five string buttons render.

Switching instrument resets tuning to "Standard" for that instrument.

### 4.4 String buttons

Each open string is represented by a `<button>`:
- Label: note name with octave, e.g. "E4". `font-size: 0.8125rem; font-weight: 700`.
- Size: fixed 44px wide, 36px tall. At 6 strings (guitar standard) the buttons wrap into two rows of 3 using `display: flex; flex-wrap: wrap; gap: 6px`.
- At 5 strings (bass 5-string) buttons are 48px wide, fitting all in one row at 260px panel width.
- `aria-label`: `"Play [note name] string"`, e.g. `aria-label="Play E4 string"`.
- Pressing a string button plays the reference tone for that note (sine wave, sustain ~3 seconds with exponential release). Pressing a second button while one is sounding stops the first and starts the new one.
- The currently sounding string button receives a visual active state: `border: 2px solid var(--klank-color-text)` and `background: var(--klank-color-highlight)`.
- Pressing the same button again while it is sounding stops the tone (toggle off).

### 4.5 Status line

A text node below the string buttons, visually separated by `margin-top: 8px; font-size: 0.6875rem; opacity: 0.7`.
- Hidden (`display: none`) when no string is sounding.
- Shows "Sounding: [note name]" when a string is active, e.g. "Sounding: E4".
- `aria-live="polite"` so screen readers announce the change without interrupting.

### 4.6 Reference pitch generation

Use the Web Audio API with a sine oscillator. Frequency for each note:

```
freq = 440 * 2^((midiNote - 69) / 12)
```

MIDI note numbers for standard guitar (low to high): E2=40, A2=45, D3=50, G3=55, B3=59, E4=64.
MIDI note numbers for standard bass 4-string (low to high): E1=28, A1=33, D2=38, G2=43.

For non-standard tunings, adjust by the semitone offset of the altered string. A lookup table mapping note-name strings to MIDI numbers is the clearest implementation.

Envelope: `GainNode` attack 5ms, sustain at gain 0.6, exponential release over 3 seconds (`exponentialRampToValueAtTime(0.001, ctx.currentTime + 3)`). Stop the oscillator after 3.05 seconds.

---

## 5. Keyboard Control Scheme

### 5.1 Existing global keys (do not collide with)

Registered in `SheetToolbar.tsx` via a `window` `keydown` listener. Active whenever `target.tagName` is not `INPUT`, `TEXTAREA`, or `contentEditable`:

| Key | Action |
|-----|--------|
| Space | Toggle auto-scroll on/off |
| `+` or `=` | Increase scroll speed |
| `-` or `_` | Decrease scroll speed |
| ArrowLeft | Previous song in playlist |
| ArrowRight | Next song in playlist |

Note: ArrowLeft/Right are only claimed when a playlist is active.

### 5.2 Proposed metronome keyboard shortcuts

The metronome keyboard shortcuts are active only while the metronome panel is open (the `keydown` listener is registered in a `useEffect` that depends on the panel's open state and cleaned up when it closes). They do not conflict with global keys because they are scoped.

| Key | Action | Conflict analysis |
|-----|--------|-------------------|
| `m` | Toggle metronome start/stop | Not claimed globally. SheetToolbar does not use letter keys. |
| `ArrowUp` | BPM +1 | ArrowUp is not claimed by SheetToolbar. |
| `ArrowDown` | BPM -1 | ArrowDown is not claimed by SheetToolbar. |
| `Shift+ArrowUp` | BPM +10 | Not claimed. |
| `Shift+ArrowDown` | BPM -10 | Not claimed. |
| `t` | Tap tempo | Not claimed globally. |
| `Escape` | Close panel (handled by dismiss logic in Section 2.5) | Standard UX convention; not claimed by SheetToolbar. |

When the metronome panel is closed, none of these listeners are active, so `m` and `t` are free for other future uses when the panel is not open.

When focus is inside the panel and ArrowUp/ArrowDown would also move focus (e.g. inside a `<select>`), `preventDefault()` is called before adjusting BPM. Engineers must check `e.target` — if it is the time-signature `<select>`, do not intercept ArrowUp/ArrowDown (let the native select handle them).

### 5.3 Proposed tuner keyboard shortcuts

The tuner panel open/close trigger:

| Key | Action | Conflict analysis |
|-----|--------|-------------------|
| `Escape` | Close tuner panel | Standard; not claimed by SheetToolbar. |

No additional global shortcuts are proposed for the tuner — string playback is inherently a pointing/click action. Tab navigation through the string buttons is the primary keyboard interaction.

### 5.4 Panel-open trigger shortcuts (global, always active)

These are convenience shortcuts to open the panels without mouse interaction:

| Key | Action | Conflict analysis |
|-----|--------|-------------------|
| `m` | Open/close metronome panel | Not claimed by SheetToolbar. |
| `t` | Open/close tuner panel | Not claimed by SheetToolbar. |

Conflict check: SheetToolbar's listener explicitly handles only `Space`, `+`, `=`, `-`, `_`, `ArrowLeft`, `ArrowRight`. Letter keys `m` and `t` are unclaimed. The chord-diagram tooltip uses ArrowLeft/ArrowRight only while pinned; those are the same keys SheetToolbar uses for playlist — this is a pre-existing tension not introduced by this feature.

Guard: the existing SheetToolbar guard (`if target.tagName === 'INPUT' || 'TEXTAREA' || isContentEditable`) already prevents `m` and `t` from firing while the user is editing tab text. The new listeners must apply the same guard.

---

## 6. Accessibility

### 6.1 ARIA roles and labels

**Toolbar trigger buttons:**
```html
<button
  aria-label="Metronome"
  aria-expanded="true|false"
  aria-haspopup="dialog"
  aria-controls="metronome-panel"
>
  <MetronomeIcon aria-hidden="true" />
</button>
```

```html
<button
  aria-label="Tuner"
  aria-expanded="true|false"
  aria-haspopup="dialog"
  aria-controls="tuner-panel"
>
  <TunerIcon aria-hidden="true" />
</button>
```

`aria-expanded` reflects the open/closed state and must update synchronously with the panel toggle.

**Panel containers:**
```html
<div
  id="metronome-panel"
  role="dialog"
  aria-modal="true"
  aria-label="Metronome"
>
```

```html
<div
  id="tuner-panel"
  role="dialog"
  aria-modal="true"
  aria-label="Tuner"
>
```

`role="dialog"` with `aria-modal="true"` signals to screen readers that interaction is constrained to the panel. Combined with the focus trap (Section 2.6), this creates a correct modal pattern without using `<dialog>` element (which would require polyfills for older WebViews in Tauri).

**Metronome panel internals:**

- BPM decrement/increment buttons: `aria-label="Decrease BPM"` / `aria-label="Increase BPM"`.
- BPM value display: a `<span>` with `role="status"` and `aria-live="polite"` so the current BPM is announced after tap-tempo or increment changes without focus movement.
- Accent radiogroup:
  ```html
  <div role="radiogroup" aria-label="Accent downbeat">
    <button role="radio" aria-checked="true">On</button>
    <button role="radio" aria-checked="false">Off</button>
  </div>
  ```
- Subdivision radiogroup:
  ```html
  <div role="radiogroup" aria-label="Subdivision">
    <button role="radio" aria-checked="true" aria-label="Quarter notes">♩</button>
    <button role="radio" aria-checked="false" aria-label="Eighth notes">♪</button>
    <button role="radio" aria-checked="false" aria-label="Triplets">♪♪♪</button>
  </div>
  ```
- Start/Stop button: `aria-pressed="true|false"` in addition to the label change. Screen reader announces "Start metronome, toggle button, pressed" when running.

**Tuner panel internals:**

- Instrument radiogroup:
  ```html
  <div role="radiogroup" aria-label="Instrument">
    <button role="radio" aria-checked="true">Guitar</button>
    <button role="radio" aria-checked="false">Bass</button>
  </div>
  ```
- Each string button: `aria-label="Play E4 string"`, `aria-pressed="true|false"` reflecting sounding state.
- Status line: `<p aria-live="polite" aria-atomic="true">Sounding: E4</p>` (hidden via `visibility: hidden` rather than `display: none` to keep the element in the accessibility tree even when silent, preventing layout shift on announce).

### 6.2 Screen reader announcement on panel open

When a panel opens, the `role="dialog"` container receives focus (via the focus management in 2.6). Screen readers will announce the dialog label ("Metronome" or "Tuner") and then the label of the focused first element. No additional `aria-live` announcement is needed for the open event itself.

### 6.3 Color and contrast

All interactive text and icons must meet WCAG 2.1 AA contrast requirements (4.5:1 for text, 3:1 for UI components). The theme tokens satisfy this at existing usage; no new tokens are needed. Active states use `var(--klank-color-highlight)` as background — engineers should verify that text on highlight meets 4.5:1 in both Light (`#f3f3f3` bg, `#020202` text = 19.6:1) and Dark (`#454545` bg, `#f6f6f6` text = 7.9:1) modes.

### 6.4 Reduced motion

The only animation in scope is the optional pendulum swing in the metronome icon or panel. Any CSS animation or transition added to either panel must be wrapped in:

```css
@media (prefers-reduced-motion: no-preference) {
  /* animation declarations here */
}
```

Do not use the inverted pattern (`prefers-reduced-motion: reduce`) — define animations only for users who have not requested reduced motion.

The beat-pulse visual indicator (if one is added — a subtle background flash on the Start/Stop button per beat) must also be suppressed under reduced motion.

### 6.5 Focus visibility

Do not suppress the browser default focus ring. Both panels use `outline` not removed. The existing klank codebase does not set `outline: none` globally (verified by absence of such a rule in the module CSS files read). Engineers must not add `outline: none` to new panel elements.

---

## 7. State and Props Summary

### 7.1 State that lives in local React state (not in the klank store)

These fields are ephemeral UI state, reset each time the panel opens:

| Field | Type | Default | Scope |
|-------|------|---------|-------|
| `metronomePanelOpen` | boolean | false | SheetToolbar or a parent |
| `tunerPanelOpen` | boolean | false | SheetToolbar or a parent |
| `bpm` | number | 120 | MetronomePanel |
| `isRunning` | boolean | false | MetronomePanel |
| `timeSignatureNum` | number | 4 | MetronomePanel |
| `timeSignatureDen` | number | 4 | MetronomePanel |
| `accentDownbeat` | boolean | true | MetronomePanel |
| `subdivision` | 'quarter' \| 'eighth' \| 'triplet' | 'quarter' | MetronomePanel |
| `tapTimes` | number[] | [] | MetronomePanel |
| `tunerInstrument` | 'guitar' \| 'bass' | from store | TunerPanel |
| `tunerTuning` | string | 'Standard' | TunerPanel |
| `soundingNote` | string \| null | null | TunerPanel |

### 7.2 Props added to SheetToolbar

```typescript
type SheetToolbarProps = {
  // ... existing props unchanged ...
  onMetronomeOpen?: () => void  // optional, for parent awareness if needed
  onTunerOpen?: () => void      // optional
}
```

The panel open/close state is owned by SheetToolbar itself (or a sibling hook) because the toolbar buttons are the triggers. No store changes are required.

### 7.3 New components (all in libs/ui/src/lib/)

- `metronomePanel/MetronomePanel.tsx`
- `metronomePanel/metronomePanel.module.css`
- `tunerPanel/TunerPanel.tsx`
- `tunerPanel/tunerPanel.module.css`
- `icons/MetronomeIcon.tsx`
- `icons/TunerIcon.tsx`
- `hooks/useFocusTrap.ts`
- `hooks/usePopoverPosition.ts` (encapsulates the positioning logic from Section 2.3)

All exports are named exports (no default exports, per project constraint).

---

## 8. Edge Cases

| Scenario | Behavior |
|----------|----------|
| User opens metronome, starts it, then navigates to a different tab file | Metronome keeps running (BPM is not tied to tab content). Panel stays open. |
| User opens metronome while auto-scroll is running | Both run independently. No interaction. |
| Metronome running, user closes panel with Esc | Metronome stops. Panel closes. Focus returns to trigger button. |
| Tuner panel open, user resizes window below 599px | Panel repositions on next open; if already open it remains at its current position (repositioning during an open interaction is jarring). Add a `resize` listener that closes the panel if `window.innerWidth` crosses the 599px threshold while a panel is open. |
| Web Audio API unavailable (old WebView, no user gesture yet) | Catch the `AudioContext` creation error. Show a one-line error inside the panel: "Audio not available". The metronome Start button becomes disabled. The tuner string buttons become disabled. |
| BPM field: user types in the value display | The BPM value display is a `<span>`, not an input, to avoid keyboard conflicts. BPM is only changed via increment buttons or tap tempo. If engineers want a direct-input field, it must suppress SheetToolbar's global `+`/`-` listeners while focused — use the existing INPUT guard. |
| 5-string bass, panel narrower than 260px (e.g. 320px screen) | Five 44px buttons plus 4×6px gaps = 244px. Fits at 260px panel width. At below 256px, reduce button width to 40px. |
| Playlist active: ArrowLeft/Right claimed globally | The metronome ArrowUp/ArrowDown proposal avoids this entirely. No collision. |

---

## 9. Files to Create or Modify

**Create (all new):**
- `/home/user/klank/libs/ui/src/lib/icons/MetronomeIcon.tsx`
- `/home/user/klank/libs/ui/src/lib/icons/TunerIcon.tsx`
- `/home/user/klank/libs/ui/src/lib/metronomePanel/MetronomePanel.tsx`
- `/home/user/klank/libs/ui/src/lib/metronomePanel/metronomePanel.module.css`
- `/home/user/klank/libs/ui/src/lib/tunerPanel/TunerPanel.tsx`
- `/home/user/klank/libs/ui/src/lib/tunerPanel/tunerPanel.module.css`
- `/home/user/klank/libs/ui/src/lib/hooks/useFocusTrap.ts`
- `/home/user/klank/libs/ui/src/lib/hooks/usePopoverPosition.ts`

**Modify:**
- `/home/user/klank/libs/ui/src/lib/sheetToolbar/SheetToolbar.tsx` — add `.toolButtons` group with two new trigger buttons; add panel open/close state; render `MetronomePanel` and `TunerPanel`; add `m`/`t` keyboard shortcuts.
- `/home/user/klank/libs/ui/src/lib/sheetToolbar/sheetToolbar.module.css` — add `.toolButtons` class mirroring `.actionButtons` border-left divider.
- `/home/user/klank/libs/ui/src/index.ts` (or the barrel export) — export the two new panel components and two new icons.

**Do not modify:**
- `/home/user/klank/libs/store/src/lib/store.ts` — no store changes required.
- `/home/user/klank/apps/klank/app/components/player/Player.tsx` — no changes required; SheetToolbar props are backwards-compatible.
- `/home/user/klank/apps/klank/app/routes.tsx` — no new routes.
