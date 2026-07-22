# Task: Cross-iframe click mirroring for sauce-control

## Context
- sauce-control is a dev tool running at http://localhost:4000
- It renders two iframes side by side: iframe A → http://localhost:4001, iframe B → http://localhost:4002 (both Next.js apps, same codebase, different worktrees)
- Different ports = cross-origin, so contentWindow/contentDocument access is normally blocked
- We must NOT modify the target apps' source code and must NOT proxy their HTML

## Approach (decided — do not substitute another)
Use a dev Chrome instance with web security relaxed, launched by sauce-control itself:
  chrome --disable-web-security --disable-features=IsolateOrigins,site-per-process --user-data-dir=<temp profile>
With those flags, sauce-control's own JS at :4000 can directly access iframe.contentDocument for both frames.

## Implement
1. A launcher script (npm script or Node script) in the sauce-control repo that:
   - Finds the local Chrome/Chromium binary cross-platform (macOS, Linux, Windows)
   - Creates a throwaway --user-data-dir under the OS temp dir
   - Launches Chrome with the flags above, opening http://localhost:4000
   - Prints a clear warning that this instance is insecure and dev-only
2. A `mirror.ts` module in sauce-control that:
   - Waits for each iframe's load event, then attaches a click listener (capture phase) on its contentDocument
   - Re-attaches listeners after any iframe navigation (listen for load again) and after Next.js client-side route changes (use a MutationObserver on document.body or hook history.pushState/replaceState inside the frame)
   - On click in one frame: builds a selector for the target element with this priority: [data-testid] → id → unique CSS path (tag + nth-of-type chain). Do not use text content in selectors
   - Finds the matching element in the OTHER frame via the same selector and calls .click() on it
   - Guards against infinite loops: set a flag (e.g. a WeakSet or a data attribute on the synthetic event) so a mirrored click is never re-mirrored
   - Fails soft: if the selector matches nothing or multiple elements in the other frame, log a console.warn with the selector and do nothing
3. A visible status indicator in the sauce-control UI: "Mirroring: active" (green) when both frames are hooked, "Mirroring: unavailable — launch via npm run dev:mirror" (amber) when contentDocument access throws. Detect this with a try/catch on contentDocument access. Ensure the indicator text has sufficient contrast against its background in both states.

## Constraints
- TypeScript, no new runtime dependencies unless strictly necessary
- All mirroring code lives in sauce-control; zero changes to the 4001/4002 apps
- Handle the case where one iframe hasn't finished loading yet

## Acceptance criteria
- npm run dev:mirror launches the flagged Chrome and opens sauce-control
- Clicking a button with a data-testid in frame A triggers the same button in frame B, and vice versa
- Client-side navigation in the apps does not break mirroring
- No mirrored click ever triggers a second mirror (no loops)
- Opening sauce-control in a normal browser shows the amber status instead of throwing errors
