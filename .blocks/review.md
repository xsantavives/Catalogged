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
- Before work, reconcile **GitHub's persisted reviews and repair evidence for the authorized delivery**, including relevant prior PRs and SHAs. If history, provenance, or concurrent session ownership cannot be verified, return `BLOCKED_COUNTER_UNVERIFIED` rather than resetting or guessing.
- If credits/capacity are exhausted, return `REVIEW_BLOCKED_CAPACITY`, without repeated retries or paid API/inference fallback. Capacity recovery never resets budgets.
- GitHub review history is the pilot's durable record. Linear controls eligibility and WIP (one active reviewer per delivery/repository). This is a **bounded pilot, not an atomic lock**: if two concurrent reviews might occur, stop and reconcile before proceeding.

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

## Factory Pilot v1 — GitHub-native review accounting (pending human merge)

The owner approved a simpler review policy on 2026-11-04 for Selthru and Catalogged. **This draft policy is inactive until separately reviewed, merged by the owner and adopted in the Blocks automation instructions.** The legacy GitHub Actions ledger and its comments must not be deleted or manually edited. This text does not grant permissions to merge or deploy.

**Delivery identity**: owner-approved Linear issue + explicitly authorized deliverable + its linked PR(s), never PR number alone. A new SHA, branch or issue link does not reset review/repair budgets. Only the owner can authorize a new deliverable with fresh 2-review/1-repair limits; preserve any historic consumption from earlier deliveries.

**Before each independent Claude review:**
1. Read current PR HEAD, CI status, existing GitHub formal reviews and relevant PR conversation comments, Linear approvals, and implementation provenance (agent/provider and commit identity).
2. Build a SHA-bound review history from persisted GitHub formal reviews with XSV_INDEPENDENT_REVIEW and recorded verdict. Count a prior independent review **once**, even if mirrored to Linear/comments. Non-independent Codex-to-Codex verification never counts as the required Claude review. Count repairs from the actual SHA-changing correction and its documented origin, not comments promising one.
3. Stop if this delivery already has two independent rounds, one repair exhausted before a further repair, unresolved ownership, an unreviewed active session, stale CI, an ambiguous previous review, or concurrent-review risk. Do not launch parallel reviewers. `BLOCKED_COUNTER_UNVERIFIED` remains the conservative response when history is not trustworthy.
4. Run Claude once against the current HEAD only if no equivalent review exists for that SHA and budget remains. Post one persisted independent formal GitHub review with exact SHA, verdict, reviewer/provider, issue/delivery identity, CI evidence, round number, findings, and next action.
5. A demonstrated P0/P1 allows one authorized Codex repair on that same PR, followed by at most one second review on the changed SHA. P2/P3 are non-blocking and require separate product authorization if ever pursued. If still failing or owner decision is needed, stop.

**Owner gate**: `ACCEPTED_FOR_OWNER_GATE` means ready for owner assessment; it never authorizes merge, deploy, publication, Shopify configuration change, production writes or spend on paid API fallbacks. No credits => pause without repeated retries.

**History that must survive transition:** For XSV-149, PR #24 already has one independent Claude CHANGES_REQUESTED review at an earlier SHA, and a subsequent repair commit. Do not reset the review/repair count; before allowing the final review, verify who actually implemented the repair and whether Claude is independent. If identity is ambiguous, block for owner clarification. PR #25 must not create fresh rounds or trigger duplicate review for consolidated work.

**Transition:** The legacy .github/workflows/xsv-review-budget.yml is kept for archival/compatibility; it is **not part of the new review dispatch preflight after the human-approved policy switch**. Do not activate the switch from this unmerged PR or allow two concurrent controllers to act. Align the Blocks review automation explicitly at switch time. Branch protection and any existing repository governance remain separate owner-managed requirements; the policy change must not weaken them silently.
