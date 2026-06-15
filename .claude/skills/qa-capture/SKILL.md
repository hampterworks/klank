---
name: qa-capture
description: Captures web page or running-app screenshots with Playwright - full-page, element, viewport variants - for visual QA, verification, and bug evidence. Use when a UI state needs capturing.
---

# Screenshot capture

Capture a web page or a running local app as an image, for visual QA, change verification, and the expected-vs-actual evidence a defect report needs. Built on Playwright's headless browser; the file is the deliverable.

Use when a UI state needs capturing. The states worth shooting are the ones `qa-explore` enumerates; the captures feed the bug reports in `qa-review`.

## Setup

Playwright plus a browser must be present. In the Claude Code web environment they already are: `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` is set and Playwright is global, so `npx playwright screenshot ...` runs with no install. Elsewhere, run `npx playwright install chromium` once first.

## Capture

1. **Pick the target.** A public URL, or a local app: start its dev server, poll the URL until it answers (do not assume a fixed boot delay), use its `http://localhost:<port>`, and shut the server down afterward.
2. **Shoot a page.** `npx playwright screenshot --full-page --ignore-https-errors <url> <out.png>`. Default viewport is 1280x720; `--full-page` captures the whole scroll height.
3. **Control the frame.** `--viewport-size "1920, 1080"` for a fixed size, `--device "iPhone 13"` to emulate a device; repeat per breakpoint to capture responsive states.
4. **Go beyond the CLI when needed.** For a specific element, a hover/focus state, dismissing a banner, or waiting for content, write a short throwaway Playwright node script: launch chromium, `page.goto`, drive the page, then `page.locator(sel).screenshot({ path })` or `page.screenshot({ path, fullPage: true })`. Keep it disposable; do not commit it.
5. **Name by state and viewport.** One file per state (empty, loading, error, logged-out, offline) and size, named for it, so the comparison is obvious.

## Gotchas

- A shot of a page that has not finished loading captures a lie; wait for the network to settle or a known element before firing, not a guessed delay.
- Full-page on infinite-scroll or lazy-loading pages can run away or miss content; wait for the specific element or cap the height instead.
- Local-app shots need the server actually up; poll until it answers, and tear it down after.
- Screenshots are not visual regression: without a stored baseline and a diff they show a moment, not drift.
- Animations, timestamps, and web fonts make shots flaky; freeze dynamic content and disable animations when the images will be compared.
- Do not commit throwaway scripts or large PNGs; keep them in a scratch/output dir.
