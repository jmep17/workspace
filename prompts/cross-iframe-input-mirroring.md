# Task: Full interaction mirroring for sauce-control (typing, forms, focus, scroll)

## Context
- Builds directly on `prompts/cross-iframe-click-mirroring.md` — that task must
  be done first. Same setup: sauce-control at :4000, iframe A → :4001,
  iframe B → :4002, flagged Chrome gives direct contentDocument access,
  `mirror.ts` already mirrors clicks with a selector ladder, echo guard, and
  fail-soft warnings.
- Idea background: `.scratch/live-compare-mirroring/brainstorm.md` (Tier 1).
- This task extends mirror.ts to text input, form controls, control keys,
  focus, form submit, and inner scroll. Same transport, same selector ladder.

## Approach (decided — do not substitute another)
Mirror at the *value/event* level, never by replaying keystrokes. Synthetic
keyboard events are untrusted (`isTrusted: false`) and will never insert text.

## Implement (all in mirror.ts, reusing the existing selector + echo machinery)
1. **Text inputs & textareas.** Listen for `input` (capture) in the source
   frame. Find the match in the other frame, then copy the ENTIRE value using
   the native prototype setter so React's value tracker doesn't swallow it:
   ```ts
   const proto = el instanceof HTMLTextAreaElement
     ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
   Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(el, value);
   el.dispatchEvent(new Event('input', { bubbles: true }));
   ```
   Whole-value copy makes paste, autofill, and IME work for free. Also mirror
   the caret via `setSelectionRange` when the element supports it.
2. **Checkboxes, radios, selects, ranges.** On `change`: set `.checked` or
   `.value` via the same native-setter pattern (use the matching prototype:
   HTMLInputElement / HTMLSelectElement), then dispatch `input` and `change`
   (both bubbling). File inputs cannot be set — emit the standard fail-soft
   warning instead.
3. **Control keys only.** Mirror `keydown`/`keyup` when `event.key.length > 1`
   (Escape, Enter, ArrowDown, Tab, …), dispatched on the other frame's
   matching element with all modifier flags copied. Never mirror printable
   keys — step 1 covers text. (Synthetic key events do reach JS handlers,
   which is all that menus, modals, and listboxes need.)
4. **Focus.** On `focusin`, call `.focus()` on the match. This is what makes
   step 3 land on the right element.
5. **Form submit.** On `submit`, call `form.requestSubmit()` on the matching
   form — NOT `.submit()`, which skips validation and submit handlers.
6. **Inner scroll sync.** On `scroll` from the frame's `scrollingElement` or
   any scrollable descendant (match the container by the selector ladder),
   mirror **proportionally**: `top / (scrollHeight - clientHeight)`, same for
   left. rAF-throttle. Branch DOMs may differ in height — never copy pixels.
7. **Retry window.** Before declaring a failed match (for every event type),
   retry the selector on a rAF loop for up to 500 ms — frame B may render
   slower than A. Only then fail-soft.

## Constraints
- TypeScript, no new runtime dependencies; all code in sauce-control.
- The echo guard must cover every new event type INCLUDING derived events: a
  mirrored click triggers focusin, a mirrored value set triggers input — none
  of these may mirror back. Hold one "applying remote event" flag across the
  entire synthetic sequence, per frame, and release it in a microtask after
  the last dispatch.
- Re-attach all new listeners in the same places the click task re-attaches
  (iframe load + soft navigation) — one shared attach function, one list of
  event bindings.

## Acceptance criteria
- Typing into a React controlled input in frame A produces the same text in
  frame B, and B's onChange logic runs (verify: a live character counter or
  filtered list in B updates).
- Pasting a string into A lands whole in B.
- Toggling a checkbox / picking a select option in A mirrors to B, firing B's
  change handlers.
- Escape closes an open modal in both frames; ArrowDown moves both listbox
  highlights when a combobox is focused.
- Submitting a form via its submit button in A submits in B, respecting B's
  validation.
- Scrolling a tall page in A scrolls B to the same proportional position even
  when B's page is a different height.
- No event ever ping-pongs: rapid typing with mirroring on stays stable in
  both directions.
- All failures (no match, ambiguous match, file input) surface as the
  existing console.warn fail-soft, after the 500 ms retry.
