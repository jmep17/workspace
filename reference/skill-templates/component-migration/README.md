# Component-migration skill pair — template

Two skills that share one body of pattern docs: an **implementation** skill that
applies documented before/after patterns one component at a time, and a
**review** skill that verifies a diff against the same patterns. One source of
truth (`references/patterns.md`) serves both directions — update a pattern and
both skills pick it up.

## How to use

1. Copy both folders into your work repo's `.claude/skills/` (check them in so
   the whole team benefits).
2. Rename the folders: replace `NEWSYS` with your target system's name, e.g.
   `migrate-aurora` and `review-aurora-migration`.
3. Search for `<...>` placeholders across all files and fill them in. The big
   ones:
   - old/new package names and import paths
   - the per-component verify command (test/build/lint)
   - where your migration ledger lives
4. Port your existing pattern doc into `references/patterns.md` — keep the
   before/after code-pair format; it outperforms prose.
5. Test before trusting:
   - run the implementation skill on one not-yet-migrated component and diff
     against how you'd have done it by hand
   - run the review skill on an already-merged migration PR and compare its
     findings with the human review feedback that PR actually got — misses
     become new checklist items

## Files

```
migrate-NEWSYS/
├── SKILL.md                    # workflow + pattern selection
└── references/
    ├── patterns.md             # before/after pairs, one section per category
    └── edge-cases.md           # gotchas discovered along the way
review-NEWSYS-migration/
└── SKILL.md                    # checklist derived from the same patterns
```
