---
name: design-write
description: Writes product copy and microcopy - buttons, errors, empty states, labels - using a clarity-concision-consistency and voice-and-tone framework. Use when writing or fixing in-product wording.
---

# Writing product content

Write the words inside the product: microcopy that is clear, concise, consistent, and humane. Reduce
doubt, guide action, and recover from failure.

Use when: writing or fixing in-product text - buttons/CTAs, errors, empty states, confirmations,
labels, help, onboarding, notifications. Not for designing the flow (`design-draft`) or critiquing
layout (`design-review`).

Apply `design-principles`: the fewest words that do the job; cut anything that does not earn its place.
For any in-app tutorials, how-tos, or help docs, apply `doc-principles` (Diataxis) - keep a tutorial,
a how-to, a reference, and an explanation distinct, never mixed.

## The three C's

1. **Clarity.** Plain language a first-time user understands at a glance. No jargon, no internal
   terms. "I forgot my password", not "Credential recovery". Lead with the user's goal.
2. **Concision.** Cut every non-working word. Front-load the key word. Prefer verbs over nouns,
   active over passive, specific over abstract.
3. **Consistency.** Same term for the same thing everywhere (do not alternate "delete"/"remove").
   Consistent capitalization, tense, and button verbs. Build or follow a terms list.

## Microcopy patterns

- **Buttons / CTAs.** A specific verb naming the outcome: "Save changes", "Send invite" - not "OK",
  "Submit". The label should make sense read alone, out of context.
- **Errors.** Say what happened, why, and how to fix it - in plain language. No blame, no codes, no
  "invalid input". Place near the cause. Best error is one prevented by good design.
- **Empty states.** A pause, not a dead end. Explain why it is empty in human terms and point to the
  next step: "You have not added any tasks yet" + a clear action. First-use empty states are an
  onboarding moment - educate or motivate.
- **Confirmations / destructive actions.** Name the specific consequence and object: "Delete 3
  files? This cannot be undone." Button verb matches the action ("Delete", not "OK").
- **Labels and help.** Persistent, descriptive field labels (not placeholder-only). Inline help only
  when it removes real doubt; otherwise cut it.
- **Success / system status.** Confirm what happened and what is next; keep it brief.

## Voice and tone framework

- **Voice is constant** - the product's personality (e.g. clear, calm, confident, human). Define it
  once with a few traits and "we are X, not Y" pairs.
- **Tone flexes by context** - warmer on success and onboarding, plain and reassuring on errors,
  neutral and efficient on routine actions. Never jokey in a moment of failure or stress.
- **Friendly means respectful and clear, not cute.** Calm, neutral wording keeps users focused.

## Inclusive and plain language

- Use plain words; write for a broad reading level and for translation.
- Inclusive and people-first; avoid idioms, slang, and culture-specific metaphors that do not translate.
- Avoid ableist or gendered defaults; second person ("you") and active voice.
- Do not rely on words placed by color or position alone to carry meaning (pairs with `design-accessibility`).

## Gotchas

- Generic buttons ("OK", "Submit", "Click here") are the most common failure - name the outcome.
- Error codes and "invalid input" are not error messages; tell the user how to recover.
- Empty states are not blank screens - each is an onboarding or guidance opportunity.
- Placeholder text is not a label and disappears on input - use a persistent label.
- One term per concept. Inconsistent vocabulary quietly raises cognitive load.
