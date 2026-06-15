---
name: design-accessibility
description: Makes a product design inclusive at the design stage - WCAG 2.2 POUR, inclusive design across impairments, an a11y checklist. Use when designing for or auditing accessibility.
---

# Designing for accessibility

Bake accessibility into the design, not the code. Cover WCAG 2.2 (POUR) decisions that are made at
the design stage and inclusive design across the full range of human ability.

Use when: making a design accessible. Shift left - `design-draft` should pull this in early so a11y
is designed in; `design-review` pulls it in late to verify. Standalone for an accessibility audit of
a design.

Apply `design-principles`: minimalism and accessibility are allies - fewer elements, clearer hierarchy,
and strong defaults reduce barriers. Delight never costs clarity or access.

## POUR - the four principles

- **Perceivable** - users can perceive the content (sight, sound, touch). Text alternatives, captions,
  not relying on color alone, sufficient contrast.
- **Operable** - users can operate it by any input. Keyboard reachable, large enough targets, enough
  time, no seizure triggers, clear focus.
- **Understandable** - predictable, consistent, readable; errors are explained and recoverable.
- **Robust** - works with assistive tech (semantics/roles); mostly an implementation concern, but
  design must name structure (headings, landmarks, labels) for engineers to wire up.

## Design-stage checklist

1. **Contrast.** Text meets 4.5:1 (3:1 for large text and UI components/graphics). Never communicate
   meaning by color alone - pair with icon, text, or pattern.
2. **Target size.** Interactive targets at least 24x24 CSS px, or smaller with 24px spacing (WCAG 2.2
   2.5.8). Aim for 44px on touch. No tiny tap zones.
3. **Focus order and visibility.** Define a logical focus/reading order matching the visual flow.
   Every interactive element has a visible focus indicator that is not obscured by sticky headers or
   overlays (WCAG 2.2 Focus Appearance, Focus Not Obscured).
4. **Alternatives.** Every image/icon/chart has a text alternative or caption planned. Media has
   captions/transcripts. Information in visuals is also available as text.
5. **Forms and errors.** Visible, persistent labels (not placeholder-only). Errors identified in text,
   near the field, with how to fix. Do not rely on color for required/invalid.
6. **No motion or input traps.** Provide non-dragging alternatives (WCAG 2.2 Dragging Movements).
   Respect reduced-motion. No content that flashes more than 3x/sec.
7. **Authentication and memory.** Do not force users to memorize or transcribe (WCAG 2.2 Accessible
   Authentication) - allow paste, password managers, copy.
8. **Readability.** Plain language, short sentences, clear hierarchy, generous spacing, resizable text
   without loss of content.
9. **Reflow and zoom.** Content reflows to a 320 CSS px-equivalent width with no horizontal scrolling or
   loss, and survives 200% text zoom (WCAG 2.2 Reflow 1.4.10, Resize Text 1.4.4). This is the same
   mobile-first responsive design `design-draft` produces, audited for access.

## Inclusive design - design for the range

Consider each, including situational and temporary cases:

- **Visual** - low vision, color blindness, blindness: contrast, scalable text, alt text, screen-reader order.
- **Motor** - tremor, one-handed, switch/keyboard-only: large targets, no precise dragging, keyboard paths.
- **Auditory** - deaf/hard of hearing: captions, transcripts, visual alerts not sound alone.
- **Cognitive** - memory, attention, literacy, neurodivergence: low cognitive load, plain language,
  consistency, forgiving flows, no time pressure.
- **Situational** - bright sun, noisy room, one hand on a phone, slow network, distracted. Designing
  for the permanent case helps everyone in the temporary one.

## Gotchas

- Accessibility is not a final QA gate. Most WCAG 2.2 criteria are cheapest to satisfy at design time.
- Color contrast and "color alone" are the two most-failed items - check both on every screen.
- Placeholder text is not a label; it vanishes and often fails contrast.
- "Accessible" is not only screen readers - motor, cognitive, and situational needs are equally real.
- Automated checkers catch a fraction; design judgment (focus order, clarity, alternatives) is required.

## Sources

- [W3C - WCAG 2.2](https://www.w3.org/TR/WCAG22/)
