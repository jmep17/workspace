# Live Compare: two desktop viewports on one screen — brainstorm

Status: idea list, nothing implemented. Companion to
`.scratch/live-compare-mirroring/brainstorm.md`; the overlay ideas below get
dramatically better once interaction mirroring exists (drive the visible
pane, the hidden one follows).

Context: Live Compare currently fits each pane with
`scale = min(1, containerWidth / targetWidth)` via CSS transform. At the
Desktop preset (1440px) two panes side by side on a ~1500px laptop window get
~50% scale each — legible as a thumbnail, unreadable as a page.

## The geometry, stated once

Two 1440×900 viewports need ~2900×900 side by side or ~1440×1800 stacked. A
laptop window offers roughly 1500×850. Either arrangement lands near 50%
scale, and no clever layout changes that arithmetic. So the options fall into
three honest strategies:

- **A. Accept scaling, make it as good as possible** (crisper, self-aware,
  reclaim every pixel of chrome).
- **B. Overlap the panes** — both occupy the SAME full-size region, and you
  alternate or blend visibility. Full native size, "both visible" via time or
  blending rather than space.
- **C. Focus + context** — keep the scaled overview, add an on-demand
  full-scale detail view.

Side-by-side is also perceptually the weakest way to spot small differences
(change blindness); overlap modes double as better diff instruments, which is
what Live Compare is for.

## A. Make the scaled side-by-side honest and sharp

1. **Scale readout + legibility warning.** Show "62% of 1440px" per pane.
   Below ~60%, tint the badge amber and suggest Stacked/Overlay. Cheap, and
   it stops "why does desktop look weird" confusion — users often don't
   realize they're looking at a transform.
2. **Reclaim chrome.** Auto-collapse the app sidebar on /live-compare and
   offer a fullscreen toggle (Fullscreen API) that leaves only a slim floating
   toolbar. On a 1500px window, sidebar + paddings can be 250+px — that's
   ~9 points of scale back.
3. **Crisper downscaling.** Try CSS `zoom` (now standardized) on the iframe
   instead of `transform: scale()` — it participates in layout (no wrapper
   negative-margin hacks) and often rasterizes text more crisply. Verify in
   the flagged Chrome; keep transform as fallback. Keep `transform-origin:
   top left` and avoid fractional pixel sizes on the wrapper either way.
4. **Free-form width input.** Presets + a numeric field (e.g. 1920 for
   "what does it do on a big monitor"), persisted in localStorage with the
   rest of the layout state.
5. **Stacked layout toggle.** Top/bottom instead of left/right. Same ~50%
   math when fitting both fully, BUT with "fit width, scroll height" it gives
   each pane ~100% scale at full window width — combined with the existing
   synced scrolling this is often the most usable reading mode for desktop
   breakpoints. Offer both fit modes: "fit both fully" and "fit width".

## B. Overlap modes — full size, shared space

The key implementation constraint for ALL mode switching: **moving an iframe
in the DOM reloads it.** Both iframes must stay in place in a stable DOM; every
layout mode is pure CSS on the same two elements (grid areas / absolute
positioning / transforms), never re-appending nodes.

6. **Blink comparator.** Both frames stacked at 100%, hold Space (or click a
   toggle) to flip which is visible (`opacity`, not `display:none`). The
   astronomer's trick: layout shifts *pop* perceptually when alternated
   in-place, far better than eyeballing two thumbnails. Trivial to build —
   highest value-per-line-of-code on this list.
7. **Onion skin.** B over A with an opacity slider (0–100%). Good for "did
   this padding change" questions; degrades into mush on busy pages, so it
   complements rather than replaces blink.
8. **Wipe/curtain slider.** `clip-path: inset()` on the top frame driven by a
   draggable vertical divider — the live-iframe version of the visual
   regression image slider (`components/ui/compare.tsx` — fix its
   `setIsMouseOver` bug if code gets reused). Lets you park the divider on
   the region under scrutiny.
9. **Difference blend.** `mix-blend-mode: difference` on the top frame over a
   white backdrop: identical pixels render black, any divergence glows. A live
   pixel-diff with zero screenshots. Verify the browser composites
   cross-origin iframe layers through blend modes; if not, fall back to blink.
10. **Input routing in overlap modes.** The top frame eats all pointer events.
    Two options, both wanted: `pointer-events: none` on the top frame ("see B,
    drive A"), and — once mirroring lands — drive the top frame and let
    mirroring keep the hidden one in step. Overlap modes + mirroring is the
    end-state: interact at full desktop size and flip/blend to compare.

## C. Focus + context — scaled overview, full-size detail

11. **Hold-to-zoom.** In scaled modes, hold Z: both panes animate to
    `scale(1)` with `transform-origin` at the cursor-equivalent point (same
    document coordinates in each pane); release snaps back to fit. Pure CSS
    transform on the existing elements — no extra app instances — and it
    keeps BOTH panes zoomed to the same spot for comparison. This is the
    cheapest way to get "readable on demand" without giving up the overview.
12. **Sticky region zoom.** Click-to-pin variant of 11: click a spot, both
    panes zoom to 100% there with synced drag-panning (minimap in the corner
    showing where you are). More build than 11; do it only if hold-to-zoom
    proves too twitchy.
13. **True loupe (probably skip).** A magnifier lens showing a 100% render of
    the hovered region would need a second pair of iframes (= two more
    running app instances) scroll-synced to the lens position. Heavy for what
    hold-to-zoom already gives; note it and move on.

## Escape hatches (no code or nearly none)

14. **Pop-out pane.** "Detach B" opens :4002 in a `window.open` popup the
    user drags to a second monitor — both apps at true 100% with zero layout
    cleverness. Mirroring transports that talk via the sauce-control server
    (or the flagged-Chrome context) keep working across windows. Cheap and
    surprisingly close to ideal for anyone with two screens.
15. **Just say it in the UI.** When Desktop preset is active on a small
    window, a one-line hint: "Tip: blink mode (Space) or detach a pane shows
    desktop layouts at 100%." Discoverability is most of the battle.

## Recommendation / sequencing

- First: mode switcher scaffold (stable-DOM constraint!) + blink (6) +
  scale readout (1) + sidebar collapse (2). Small, transforms the feature.
- Second: onion skin (7) + wipe (8) share the same overlay scaffold; add
  hold-to-zoom (11) for the scaled modes.
- Then: difference blend (9) and pop-out (14) as stretch; stacked fit-width
  (5) when asked for.
- Persist mode + widths + opacity in localStorage; all modes keep the panes'
  existing URL/status plumbing untouched.
