# Prompt: generate the migration skill pair from existing docs

Fill in every `[bracketed]` value, then paste the whole thing into Claude Code
in the work repo. It is self-contained — it doesn't assume the target repo has
any template files. A fillable version of the skills it generates lives in
`reference/skill-templates/component-migration/`.

---

I'm running a component migration from [OldSystem] ([@org/old-package]) to
[NewSystem] ([@org/new-package]). The migration patterns are documented and a
number of components are already migrated. Build two Claude Code skills from
that existing material, then commit and push them.

Source material:

- Pattern documentation: [path/to/migration-doc.md]
- Migration ledger / list of completed components: [path, or "infer it from git
  history and create it"]
- Representative migrated components to learn from: [ComponentA, ComponentB,
  ComponentC] — run `git log --follow -p` on their files to see the real
  before/after transforms; real diffs beat the prose docs where they disagree.

Create these in `.claude/skills/`:

```
migrate-[newsys]/
├── SKILL.md
└── references/
    ├── patterns.md
    └── edge-cases.md
review-[newsys]-migration/
└── SKILL.md
```

Implementation skill (`migrate-[newsys]`):

- SKILL.md holds the workflow only, roughly 50 lines: categorize the component
  against the pattern index in references/patterns.md and read only the
  matching section; apply the before → after transform mechanically without
  improving adjacent code (consistency across the migration matters more than
  local polish); update imports so no file imports both systems; verify with
  [per-component test/build command]; grep the changed files for strings that
  must not survive ([old import path], [deprecated prop names], [old CSS
  prefix/tokens]); record the component in the ledger.
- Include a "When no pattern matches" section: find the 2–3 most similar
  already-migrated components in the ledger, study their transforms via
  `git log --follow -p`, and if the shape is genuinely new, stop and flag it
  for a human decision instead of inventing a pattern.
- references/patterns.md: an index table at the top (category / applies when),
  then one section per category. Extract the before/after code pairs from real
  migration commits, trimmed to the minimal diff — don't invent examples. Each
  section needs: "Applies when", Before, After, "Why it's done this way"
  (including constraints like deprecated aliases that must stay), and "Watch
  out for" (the common way the pattern gets half-applied).
- references/edge-cases.md: seed it with gotchas already recorded in the docs,
  structured as an append-as-you-go log (symptom / cause / do instead), and
  have SKILL.md tell Claude to append new ones after each migration.

Review skill (`review-[newsys]-migration`):

- A checklist of objectively verifiable checks, each reported pass/fail with
  file:line evidence: (1) right pattern chosen and fully applied — flag files
  mixing old and new APIs; (2) grep for the survivor strings — a hit is a
  finding even in a comment or test; (3) scope check — flag behavior changes,
  renames, or cleanups smuggled in alongside the mechanical transform; (4)
  consistency with precedent — compare against an already-migrated component
  of the same category from the ledger, divergence is a finding even when the
  code works; (5) tests pass and any snapshot updates are expected consequences
  of the pattern; (6) ledger updated.
- Output format: ✓/✗ per check with one line of evidence, then a verdict —
  ready / ready with nits / needs changes — with blocking findings first.
- It must read the same references/patterns.md as the implementation skill via
  a relative link, not a copy — one source of truth for both skills.
- If the diff contains a transform matching no documented pattern, it should
  flag that as needing a human decision and a patterns.md entry, not approve
  or improvise.

Frontmatter descriptions: make them pushy and use our real vocabulary — the
actual package and system names. The implementation skill triggers on
migrating/converting/updating components or touching any file that still
imports [@org/old-package], "even if the user doesn't say migrate". The review
skill triggers on reviewing any PR, branch, or diff that touches the migration.
Include 2–3 realistic trigger phrases in each.

Sanity checks before committing:

- Run the review skill's grep checks against one already-merged migration PR
  and confirm the findings are sensible.
- Confirm every pattern category in the source docs appears in patterns.md's
  index table.

Then create a branch [branch naming convention, e.g. chore/migration-skills],
commit following [commit message convention], and push. [Don't open a PR — I'll
do that myself. / Open a PR titled "..."]
