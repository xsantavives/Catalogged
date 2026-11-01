---
name: xsv-independent-review
description: Independently audit a bounded code slice at an exact commit SHA with adversarial tests and explicit GO/NO-GO evidence.
---
# Independent review
Start from immutable PR head SHA and approved acceptance issue; do not inherit implementation agent's conclusions. Inspect product boundaries, diff, correctness, auth/tenancy, idempotency, provenance, regression tests and omissions. Add or run adversarial cases only in isolated worktree; do not modify implementer's branch. Return exact commands, failing/passing outcomes, remaining P0/P1/P2, evidence and a recommendation: ACCEPT / CHANGES_REQUIRED / BLOCKED_BY_EXTERNAL_EVIDENCE. Never treat agent review as financial, legal, commercial or security sign-off. Never silently close a Notion/Linear gate.
