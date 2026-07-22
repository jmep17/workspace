# Task: Layout modes for comparing two desktop-sized viewports in Live Compare

## Context
- Live Compare (app/live-compare/live-compare.tsx) shows iframe A and iframe B
  side by side, each scaled with `min(1, containerWidth / targetWidth)` via
  CSS transform. At the 1440px Desktop preset on a laptop window both panes
  land near 50% scale — fully visible but unreadable.
- Two desktop viewports genuinely don't fit on one screen at 100%; the fix is
  new layout modes, not cleverer scaling. Idea background and rationale:
  `.scratch/live-compare-dual-desktop/brainstorm.md`.

## Approach (decided — do not substitute another)
Add a layout-mode switcher. Both iframes stay mounted at fixed positions in a
stable DOM; every mode is pure CSS (grid/absolute positioning, transform,
opacity) on the same two elements. **Never reparent or re-append an iframe —
that reloads it and loses app state.**

## Implement
1. **Mode switcher** in the toolbar: `Side by side` (default, current
   behavior) · `Stacked` · `Overlay`. Persist mode and all sub-settings in
   localStorage.
2. **Scale readout.** Per pane, show the effective scale as "62% of 1440px".
   Below 60%, style it amber and add a tooltip suggesting Overlay mode.
3. **Stacked mode.** Panes top/bottom with two fit options: "fit both"
   (scale so both viewports are fully visible) and "fit width" (each pane at
   `min(1, containerWidth / targetWidth)` — near 100% for desktop widths —
   with the existing synced scrolling doing the comparison work).
4. **Overlay mode.** Both frames occupy the same full-size region at 100%
   scale (container scrolls if the viewport is larger than the window):
   - **Blink**: holding Space (when focus is not in a text field) shows frame
     B; releasing shows frame A. Implement with `opacity` — never
     `display: none`. Also a click toggle for mouse-only use.
   - **Onion skin**: an opacity slider (0–100%) for frame B over frame A.
     Blink and the slider coexist: Space temporarily forces B fully opaque.
   - **Input routing toggle**: "Interact with A / B" sets
     `pointer-events: none` on the other frame. Show which frame is
     interactive at all times.
5. **Hold-to-zoom** (Side-by-side and Stacked "fit both" only): holding Z
   animates both panes to `scale(1)` with `transform-origin` at the
   cursor-equivalent point — same in-document coordinates in each pane, i.e.
   translate the cursor position through the pane's current scale. Releasing
   Z animates back to fit. ~120ms ease-out transition; no extra iframes.
6. **Reclaim chrome.** Auto-collapse the app sidebar while on /live-compare
   (restore on leave), and add a fullscreen toggle (Fullscreen API) that
   hides everything except a slim floating toolbar.

## Constraints
- React + Tailwind, no new runtime dependencies.
- The two iframes' existing plumbing (URL sync, status badges, scroll sync,
  and any mirroring hooks) must keep working untouched in every mode.
- Keyboard shortcuts (Space, Z) must not fire while typing in the path input,
  and must not scroll the page (preventDefault on Space).
- Mode switching must never cause an iframe reload — verify by switching
  through all modes with form state entered in both apps.

## Acceptance criteria
- Switching between all three modes preserves iframe state (test: type into a
  form in both apps, cycle every mode, text survives).
- Desktop preset in Overlay mode renders both apps at 100%; holding Space
  flips between them in place with no layout shift.
- Onion-skin slider at 50% shows a blended composite; input routing toggle
  determines which app receives clicks, and the UI says which.
- Hold-to-zoom brings the point under the cursor to 100% in BOTH panes at the
  same document location; release returns to the fitted view.
- Scale readout matches the actual applied scale and turns amber below 60%.
- Sidebar is collapsed on /live-compare and restored elsewhere; fullscreen
  mode shows only panes + floating toolbar.
- Mode, fit option, opacity, and input routing survive a page reload
  (localStorage).
