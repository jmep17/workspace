# Migration patterns: <OldSystem> → <NewSystem>

## Pattern index

Pick the category first, then read only that section.

| # | Category | Applies when |
|---|----------|--------------|
| 1 | <e.g. prop rename> | <component uses props renamed in NewSystem> |
| 2 | <e.g. wrapper removal> | <component wraps OldSystem primitive that NewSystem provides directly> |
| 3 | <e.g. hook swap> | <component consumes OldSystem context/hook> |

## Pattern 1: <name>

**Applies when:** <the recognizable shape in the old code>

**Before:**

```tsx
<paste a real, minimal example from an actual pre-migration component>
```

**After:**

```tsx
<the same component post-migration>
```

**Why it's done this way:** <the constraint that makes this the right transform —
e.g. "we keep the old prop as a deprecated alias because X still consumes it".
This is what stops a well-meaning agent from "cleaning up" things that must stay.>

**Watch out for:** <the common way this pattern gets half-applied>

## Pattern 2: <name>

<same structure — Applies when / Before / After / Why / Watch out for>

<!--
Tips for porting your existing doc into this file:
- Real code beats invented code: pull before/after pairs from actual migration
  commits (`git log --follow -p <file>`), then trim to the minimal diff.
- One section per category; keep the index table in sync.
- If a section grows past ~100 lines, split it into its own file and link it
  from the index.
-->
