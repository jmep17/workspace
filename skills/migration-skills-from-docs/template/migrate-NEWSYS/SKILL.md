---
name: migrate-NEWSYS
description: "Migrates a component from <OldSystem> to <NewSystem> using the documented before/after patterns. Use whenever migrating, converting, or updating a component to <NewSystem>, when the user mentions the migration, or when touching any file that still imports from <@org/old-package> — even if they don't say \"migrate\". Trigger phrases: \"migrate <Button>\", \"convert this to <NewSystem>\", \"move this off <OldSystem>\"."
---

# Migrate a component to <NewSystem>

Migrate one component at a time using the documented patterns. Apply them
mechanically — the goal is consistency across the whole migration, not local
redesign. A migrated component should look like every other migrated component
of its category.

## Steps

1. **Categorize.** Read the pattern index at the top of
   [references/patterns.md](references/patterns.md), decide which category the
   component falls into, then read only that category's section.
2. **Apply the transform exactly.** Follow the before → after pair for the
   category. Don't "improve" adjacent code, rename unrelated things, or clean
   up styles the pattern doesn't mention — behavior changes smuggled into a
   mechanical migration are the main way these PRs go wrong.
3. **Update imports.** Old: `<@org/old-package>` → new: `<@org/new-package>`.
   Remove the old import entirely; a file importing from both systems is a
   half-migrated file.
4. **Verify.** Run `<per-component test/build command, e.g. npm test -- Button>`.
   If the component has visual/snapshot tests, update snapshots only when the
   diff is an expected consequence of the pattern.
5. **Grep for survivors.** These strings must not remain in the migrated files:
   - `<old import path>`
   - `<deprecated prop name>`
   - `<old CSS class prefix / token>`
6. **Update the ledger.** Record the component in `<ledger location, e.g.
   docs/migration/completed.md>` with its category and date.

## When no pattern matches

Don't invent a new pattern. Instead:

1. Find the 2–3 most similar already-migrated components in the ledger.
2. Study their actual transforms: `git log --follow -p <migrated file>` shows
   the real before/after — better evidence than any prose description.
3. If the shape is genuinely new, stop and flag it for a human decision. A
   wrong improvised pattern replicated across later components costs far more
   than a pause.

Check [references/edge-cases.md](references/edge-cases.md) before flagging —
the gotcha may already be documented.

## After migrating

If you hit a new gotcha, append it to `references/edge-cases.md` so the next
migration doesn't rediscover it.
