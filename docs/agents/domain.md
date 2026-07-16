# Domain Docs

How engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read

- **`CONTEXT.md`** at the repo root — the glossary / ubiquitous language and high-level context.
- **`CONTEXT-MAP.md`** at the repo root, if it exists — points to one `CONTEXT.md` per context. Read each one relevant to the topic. (Not used in this single-context repo.)
- **`docs/adr/`** — read the ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence and don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` or `/improve-codebase-architecture`) creates them lazily as terms and decisions actually get resolved.

## File structure

This is a single-context repo:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-example-decision.md
│   └── 0002-another-decision.md
└── src/
```

(A multi-context repo would carry a root `CONTEXT-MAP.md` pointing at per-context `src/<context>/CONTEXT.md` and `src/<context>/docs/adr/` directories. This repo is not laid out that way.)

## Use the glossary's vocabulary

When output names a domain concept (in an issue title, refactor proposal, hypothesis, or test name), use the term defined in `CONTEXT.md`. Don't drift into synonyms the glossary explicitly avoids.

If a concept you need isn't in the glossary yet, that's a signal to add it via `/domain-modeling` — don't silently coin a competing term.
