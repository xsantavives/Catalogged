# XSV Engineering — Bounded Independent PR Review

This file is the **repository-specific review prompt** for Blocks PR Review and is also to be read explicitly by any Blocks review automation. It does not, by itself, activate Blocks or enforce an iteration budget.

## Authority and review eligibility

- Read `AGENTS.md`, relevant scoped `AGENTS.md` files, the authoritative product contract, the approved Linear issue and its frozen acceptance criteria before assessing the diff.
- Check PR base, current HEAD SHA, CI and prior reviews. Review **that exact HEAD**, not a moving branch or an earlier SHA.
- Require a verifiable association to approved Linear work or an explicitly authorized configuration-only change. Do not assume a PR or a link authorizes scope.
- The reviewer must be in a separate agent execution and from a **different provider/model family** than the implementing agent. If independence cannot be established, return `REVIEW_BLOCKED_INDEPENDENCE`.
- Never self-approve, merge, deploy, modify code, edit acceptance criteria or create follow-on work while reviewing.

## What to review

1. Violations of the approved acceptance criteria or the repository's hard product invariants.
2. Demonstrable correctness/data-integrity/security/authorization defects introduced by the current diff.
3. Relevant regressions and integration contracts, with minimal reproductions and accurate CI evidence.
4. Read-only versus write boundaries; confidentiality, tenancy, idempotence and provenance when applicable.

For each blocking finding supply **severity, file/line, observed versus expected behavior, reproduction or failing test, and exact acceptance criterion/invariant affected**. A hypothesis without a demonstrated material impact is `P2 / investigate`, not an automatic blocking `P1`.

## Severity

- `P0`: security breach, cross-tenant exposure, irreversible unauthorized operation or critical data corruption.
- `P1`: reproducible violation of an agreed acceptance criterion, material regression, wrong core decision, or materially unsafe release behavior.
- `P2`: non-blocking defects, unclear edge behavior, robustness improvements or unproven risk.
- `P3`: style, naming, speculative architecture, optional refactors or future product scope.

**Only demonstrated P0/P1 can request repair of the current PR.** P2/P3 go to a separately approved issue if worth doing. Never expand scope solely to satisfy a reviewer's preferences. Respect the existing contract and tests over invented requirements. Do not demand tests for already-covered unchanged behavior.

## Bounded review contract

- At most **2 independent review rounds** and **1 autonomous repair round** per approved Linear issue/PR delivery.
- Round 1: no P0/P1 -> `ACCEPTED_FOR_OWNER_GATE`; P0/P1 -> `CHANGES_REQUESTED` with a bounded repair list.
- Round 2 (only after the authorized repair on a new SHA): no P0/P1 -> `ACCEPTED_FOR_OWNER_GATE`; any P0/P1 -> `BLOCKED_HUMAN_DECISION_REQUIRED`.
- A new commit does not reset round counts. Repeated review on the same SHA/policy is a duplicate and must stop.
- Never open a third review or a second autonomous repair. A separate issue can be authorized by an owner; do not create or approve it yourself.
- Before work, read **durable, shared iteration counters** outside the agent session. If you cannot verify their persistence and current values, return `BLOCKED_COUNTER_UNVERIFIED` instead of starting another round.
- If credits/capacity are exhausted, return `REVIEW_BLOCKED_CAPACITY`, without repeated retries or paid API/inference fallback. Capacity recovery never resets budgets.
- These instructions do **not** implement persistent counters or provider credit probes. An external gate (Linear/GitHub/Blocks workflow controller) must enforce them before full autonomy.

## Deliverable

Return exactly one final disposition:
`ACCEPTED_FOR_OWNER_GATE`, `CHANGES_REQUESTED`, `BLOCKED_HUMAN_DECISION_REQUIRED`, `BLOCKED_COUNTER_UNVERIFIED`, `REVIEW_BLOCKED_CAPACITY`, or `REVIEW_BLOCKED_INDEPENDENCE`.

Include repo/PR, reviewed HEAD SHA, authorized issue/scope, reviewer independence, CI status, P0/P1 findings, explicitly deferred P2, review round and repair round, and the next **permitted** action. An accepted review does not authorize a merge or deployment.

## Catalogged product-specific review gates

- Evaluate only the authorized **First Catalog Incident** slice against its current Linear issue and the frozen product fixtures. An expired historical bet cannot authorize new scope.
- Preserve an evidence-first sequence: original observed catalog state -> authorized change -> propagation -> first demonstrable divergence; no invented causality.
- Shopify access stays `read_products` only. No catalog writeback, rollback, auto-remediation, billing, scraping, speculative inference or unrelated product expansion.
- Review source identity, timestamps, provenance, replay/idempotence and uncertainty; explicitly distinguish missing evidence from a confirmed incident.
- A synthetic fixture, CI green or technical completeness is not proof of a merchant incident or purchase intent.
- Do not alter frozen fixtures, database migrations or external integrations without explicit approved scope.
