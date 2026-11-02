# XSV Review Budget Gate v1

**Scope:** Selthru and Catalogged pilots. This is a GitHub Actions budget ledger, NOT an agent executor.

## Persistence and atomicity

- GitHub [dedicated ledger issue #30](https://github.com/xsantavives/Catalogged/issues/30) holds one github-actions[bot] comment per Linear issue, shared across all PRs. The comment stores review_rounds, repair_rounds, identity, event history and the active reservation.
- A manual workflow_dispatch on **main** applies one transition, serialized by Linear issue ID with GitHub Actions concurrency.
- Budget is **two reserved independent reviews and one reserved autonomous repair**, per repository + Linear issue. A second PR pointing to the same Linear issue is blocked rather than resetting the budget. A changed SHA/provider cannot reset these counters.
- Before launch, reserve-review increments a slot and records a reservation ID. After the formal GitHub independent review is submitted on the same HEAD, finish-review must supply that review ID.
- If the first result is CHANGES_REQUESTED, Codex can reserve-repair once. After the PR HEAD changes, finish-repair records completion, enabling the second review.
- Second CHANGES_REQUESTED is converted to BLOCKED_HUMAN_DECISION_REQUIRED. Accepted work never triggers further reviews.
- Interrupted execution keeps its reservation active; only owner reconciliation can unblock it. An already-reviewed PR with no existing ledger fails closed instead of starting counters at zero.

## Workflow operations

Workflow name: XSV Review Budget Gate

Run on default branch main only, using operation, pr_number, linear_issue and expected_sha. Additional inputs for finish-review are reservation_id, review_id and verdict. finish-repair requires reservation_id.

Operations:
- status — read current ledger; no write.
- reserve-review — reserve one review slot before invoking Claude.
- finish-review — submit exact GitHub review ID/HEAD and matching verdict after posting review.
- reserve-repair — reserve the only Codex repair before editing code.
- finish-repair — confirm current PR HEAD changed after reserved repair.

Always inspect the workflow run success and the PR's github-actions[bot] ledger comment before starting a model. A dispatched run is not proof of success. GitHub review evidence must include marker XSV_INDEPENDENT_REVIEW and a standalone VERDICT line.

**No schedule and no automatic model invocation are installed by this workflow.** Blocks must explicitly dispatch/poll this gate. If Blocks cannot do that with its current GitHub permissions, return BLOCKED_COUNTER_UNVERIFIED; do not bypass the gate. Do not create another Blocks review automation.

## Security and activation gates

- Repo main branch must be protected and CODEOWNERS/required reviews must cover .github/workflows/ and .github/review-budget/. Both pilots were observed without branch protection before implementation.
- Verify GitHub Actions can write PR issue comments using job-level issues: write permission.
- Verify Blocks has authorization to dispatch the workflow (Actions write), poll the run, and read the ledger; these capabilities are not established by the test suite.
- A new PR for the same Linear issue cannot bypass exhausted counters. The gate confirms durable counts and exact GitHub review evidence; it does not independently authenticate the underlying Claude/Codex provider identity or prove Linear acceptance. Blocks remains responsible for those checks.
- Ledger issue comments are visible to anyone who can read the repository (Catalogged is public). Never add secrets, merchant information or sensitive findings to ledger fields.
- Never edit the ledger comment manually. A false, duplicated or missing ledger blocks instead of allowing a reset.

## Acceptance

Local offline tests cover reservation limits, completion, stale SHAs, missing evidence, counter conflicts, duplicate reservations and blocked interruption. CI tests alone do not prove live GitHub API permissions, workflow dispatch from Blocks, or cross-provider independence. Keep autonomous reviews off until those three runtime gates have been verified.

## Canonical ledger location

Ledger: https://github.com/xsantavives/Catalogged/issues/30 (workflow pins XSV_LEDGER_ISSUE=30). Never move or close it without revising the workflow and migrating existing entries under owner supervision.
