---
name: review-NEWSYS-migration
description: "Reviews a diff or PR that migrates components from <OldSystem> to <NewSystem>, checking the documented patterns were applied fully and nothing extra was smuggled in. Use when reviewing any PR, branch, or diff that touches the migration, adds <@org/new-package> imports, or removes <@org/old-package> ones. Trigger phrases: \"review this migration PR\", \"check the <Button> migration\", \"is this migrated correctly\"."
---

# Review a <NewSystem> migration diff

Verify the diff against the documented patterns in
[../migrate-NEWSYS/references/patterns.md](../migrate-NEWSYS/references/patterns.md).
Work through every check below and report each as pass/fail with file:line
evidence — don't skip the greps in favor of eyeballing; the greps are the
highest-signal checks.

## Checks

1. **Right pattern, fully applied.** Categorize each migrated component using
   the pattern index, then confirm the diff matches that category's after-shape.
   Flag hybrids: files that apply part of a pattern, or mix old and new APIs.
2. **No survivors.** Grep the changed files (and any files they render or
   re-export) for strings that must not outlive migration:
   - `<old import path>`
   - `<deprecated prop name>`
   - `<old CSS class prefix / token>`
   A single hit is a finding, even in a comment or test.
3. **Scope check.** The diff should contain the mechanical transform and
   nothing else. Flag behavior changes, renames, refactors, or style cleanups
   the pattern doesn't call for — they belong in a separate PR where they can
   be reviewed as what they are.
4. **Consistency with precedent.** Pick an already-migrated component of the
   same category from the ledger and compare shapes. Divergence from precedent
   is a finding even when the code "works" — consistency is a correctness
   criterion for migrations, because the next reader assumes one pattern.
5. **Verification ran.** Confirm `<per-component test command>` passes for each
   migrated component. Snapshot updates are acceptable only where the visual
   change is an expected consequence of the pattern — call out any that aren't.
6. **Ledger updated.** Each migrated component appears in
   `<ledger location>` with its category.

## Output

For each check: ✓/✗, one line of evidence (file:line or command output).
End with a verdict: **ready**, **ready with nits**, or **needs changes**, and
list the blocking findings first.

If the diff contains a transform that matches no documented pattern, don't
approve or improvise a judgment — flag it as a new pattern that needs a human
decision and a patterns.md entry.
