---
description: Write a handoff document to handoffs/ in the project root so a fresh agent can pick up the work.
argument-hint: "[optional: the intention of the handoff / what the next session will focus on]"
---

Write a handoff document summarising the current conversation so a fresh agent can continue the work.

Save it to a `handoffs/` directory in the root of the current project (the git repository root, or the working directory if not in a repo). Create the directory if it doesn't exist. Name the file `<YYYY-MM-DD>-<short-slug>.md`, where the slug describes the work being handed off.

The document should cover:

- **State of the work** — what was done, what's in flight, what's verified vs. assumed.
- **Next steps** — concrete actions the next agent should take, in order.
- **Key context** — decisions made and why, dead ends already explored, gotchas discovered.
- **Suggested skills** — skills the next agent should invoke.

Do not duplicate content already captured in other artifacts (specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

Redact any sensitive information, such as API keys, passwords, or personally identifiable information.

$ARGUMENTS

If arguments were passed above, treat them as the intention of the handoff — what the next session will be used for — and tailor the document accordingly.
