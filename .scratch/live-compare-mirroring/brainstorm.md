# Live Compare: interaction-mirroring brainstorm

Status: idea list, nothing implemented. Builds on
`prompts/cross-iframe-click-mirroring.md` (decided approach: sauce-control
launches Chrome with `--disable-web-security` so its own JS at :4000 can reach
both iframes' `contentDocument` directly; click mirroring with a
data-testid → id → CSS-path selector ladder, echo guard, fail-soft).

Context: Live Compare shows two worktrees of the same app side by side
(iframe A → :4001, iframe B → :4002). Today only the outer URL bar and outer
scroll are synced. Goal: drive ONE pane and have the other follow — typing,
clicking, navigation — so a manual walkthrough exercises both branches at once.
Ideas grouped and roughly ordered by impact-vs-effort.

## Tier 1 — the core input types (extend mirror.ts)

1. **Text typing — mirror `input` events, not key events.** Synthetic keyboard
   events are untrusted (`isTrusted: false`), so the browser never inserts text
   from them; replaying keydowns into frame B does nothing. Instead listen for
   `input` on frame A, find the matching element in B, and set its value. For
   React controlled inputs you must bypass React's own value tracker with the
   native prototype setter, then dispatch `input` so `onChange` fires:

   ```ts
   const proto = el instanceof HTMLTextAreaElement
     ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, newValue);
   el.dispatchEvent(new Event('input', { bubbles: true }));
   ```

   Copy the whole value each time (don't diff keystrokes) — this makes paste,
   autofill, and IME composition free: whatever landed in A's field lands in
   B's. Optionally mirror `setSelectionRange` for caret parity.

2. **Checked/selected state — mirror `change`.** Checkboxes and radios: set
   `.checked` via the same native-setter trick and dispatch both `click`-ish
   `input` and `change`. `<select>`: set `.value`, dispatch `change`. Range
   sliders: `.value` + `input`. File inputs cannot be set programmatically —
   fail-soft with a warning toast.

3. **Richer click sequence.** A bare `.click()` misses components that act on
   `pointerdown`/`mousedown` (dropdown menus, comboboxes, drag handles,
   Radix/Headless-style popovers). Mirror the full sequence on the matched
   element: `pointerover → pointerdown → mousedown → focus() → pointerup →
   mouseup → click`, carrying modifier keys (`shiftKey`, `metaKey`, …) and
   coordinates translated to the target element's own bounding box (some libs
   read `clientX/Y` to position popovers).

4. **Control keys — mirror `keydown` for non-text keys only.** Synthetic key
   events won't insert text, but JS handlers still receive them — which is
   exactly what Escape (close modal), Enter (submit), arrows (menu/listbox
   navigation), and Tab-trap logic use. Mirror `keydown`/`keyup` when
   `key.length > 1` (Escape, Enter, ArrowDown, …) into B's matching focused
   element. Skip printable keys — idea 1 covers those.

5. **Focus/blur mirroring.** On `focusin` in A, call `.focus()` on the match
   in B. Cheap, and it makes idea 4 work (the control key lands on the right
   element) plus keeps focus-styled states visually comparable.

6. **Form submit.** Mirror the `submit` event via `form.requestSubmit()` on
   the matched form (not `.submit()`, which skips validation and onSubmit).

7. **Inner scroll sync.** The existing sync only mirrors the outer pane
   containers; with contentDocument access, sync the real thing: `scroll` on
   each frame's `scrollingElement` plus any scrollable sub-containers (match
   by selector). Mirror **proportionally** (`scrollTop / (scrollHeight -
   clientHeight)`) rather than absolute pixels — the branches may legitimately
   differ in content height, which is the whole point of comparing them.
   Throttle with rAF; reuse the existing echo-guard pattern.

## Tier 2 — navigation & app state

8. **SPA route sync + URL bar feedback.** Clicks that navigate are mirrored as
   clicks, but the panes can still drift (redirects, guards, branch-different
   link targets). Hook `history.pushState`/`replaceState` and `popstate`
   inside each frame; when A's path changes, verify B arrived at the same path
   (after a short grace period) and hard-navigate B if not. Also write the
   current path back into Live Compare's path input — today it goes stale the
   moment you click a link inside a pane.

9. **Storage/state sync button.** A one-shot "Copy state A → B" action that
   clones `localStorage`, `sessionStorage`, and non-HttpOnly cookies, then
   reloads B. Comparing branches is only meaningful from the same starting
   state (auth, feature flags, carts); today you have to set that up twice by
   hand.

10. **Divergence log — turn mirror failures into the product.** The branches'
    DOMs *will* differ; that's what you're looking for. Every failed or
    ambiguous selector match is a behavioral-diff signal, not just an error.
    Instead of only `console.warn`: flash a red outline on the source element,
    and append to a visible "Divergences" panel — timestamp, event type,
    selector tried, pane. After a session, that panel is a review artifact:
    "these 4 interactions had no counterpart in branch B."

11. **Match-quality ladder with fuzzy fallback.** Extend the selector ladder
    for cross-branch resilience: `data-testid` → `id` → `aria-label`/`name`
    attr → role + accessible name → structural CSS path (last, it's the most
    brittle across branches). Tag each mirrored event with match confidence;
    low-confidence matches get an amber outline in B so you know the mirror
    guessed. Also retry a failed match for ~500 ms on a rAF loop before
    declaring divergence — B may simply render slower than A (different
    branch, different perf).

## Tier 3 — UX affordances

12. **Ghost cursor.** Render a small dot/crosshair overlay in the follower
    pane at the mirrored position (translated via the matched element's rect).
    CSS `:hover` can't be faked, but seeing *where* the interaction landed in
    B makes the mirroring legible. Flash the matched element's outline green
    on every successful mirror.

13. **Mirror mode toggle.** `Both ⇄` / `A → B` / `B → A` / `Off`, plus a
    pause hotkey (e.g. hold Alt to interact with one pane *without*
    mirroring — you need this constantly when the panes drift and you want to
    nudge one back into sync by hand).

14. **Hover mirroring (JS-level).** Mirror `pointerover`/`pointerout` so
    React `onMouseEnter` tooltips/menus open in both panes. Off by default
    (noisy); combine with the ghost cursor.

15. **Event ticker.** A one-line log ("click `[data-testid=add-to-cart]` ✓",
    "input `#search` ✓", "submit `form.checkout` ✗ no match") so you can see
    what the mirror thought happened. Doubles as the data source for idea 16.

## Tier 4 — record & replay (bridge to Visual Regression)

16. **Record interaction scripts.** The mirrored event stream is already a
    serialized list of `{selector, eventType, value, timestamp}` — persist it
    as JSON ("recordings"). This falls out of the mirroring work nearly free.

17. **Replay against both panes.** Play a recording into both frames with
    Playwright-style waiting (wait for selector to exist/be visible before
    each step, not fixed timestamps — the branches run at different speeds).
    Now a manual walkthrough recorded once becomes a repeatable comparison
    scenario.

18. **Hand-off to Visual Regression.** Replay + screenshot after each step +
    the existing diffing pipeline = automated *interaction* regression, not
    just route-level screenshots. Recordings become named scenarios in
    `visual-regression.config.ts`. This is the end-state that makes the whole
    mirroring investment compound.

## Architecture note — a cleaner path than --disable-web-security

The flagged-Chrome approach is fine for a prototype, but two upgrades are
worth keeping in mind (not blocking Tier 1, which works as-is on top of it):

- **CDP / Playwright injection.** Visual Regression already implies a
  Playwright/Chromium dependency. Launch a persistent context from
  sauce-control's server, `page.frames()` gives handles to both cross-origin
  frames, and `addInitScript` injects the mirror agent into every navigation
  automatically — no security flags, no re-attach-on-load bookkeeping, works
  in a normal browser profile. Agents relay events through the sauce-control
  server over WebSocket instead of touching `contentDocument` at all.
- **Same trick, live browser:** a tiny dev-only extension (content script on
  `http://localhost:*`, all_frames: true) relaying over WebSocket gets the
  same result in the user's everyday Chrome, at the cost of "load unpacked
  extension" setup.

Either path keeps every Tier 1–4 idea intact — only the transport changes
(direct DOM access → per-frame agent + relay). Worth doing if mirroring
graduates from prototype.

## Known traps (write these into any implementation prompt)

- **Echo loops**: the existing WeakSet/flag guard must cover *every* mirrored
  event type, including derived ones (mirrored click → focus → focusin
  handler fires → tries to mirror focus back). Suppress by "currently
  applying remote event" flag held across the whole synthetic sequence.
- **React 16+ value tracker**: without the native-setter trick (idea 1),
  setting `.value` directly makes React swallow the subsequent `input` event
  as a no-op. This is the #1 reason naive typing mirrors silently fail.
- **Timing skew**: never assume B is ready when A is; every mirror is
  fail-soft with short retry (idea 11), every replay step waits (idea 17).
- **iframe reloads**: HMR and hard navigation replace the contentDocument;
  listeners must re-attach on every `load` *and* soft navigation (already in
  the click prompt — applies to all new event types too).
