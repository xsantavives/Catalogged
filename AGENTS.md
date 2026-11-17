# Catalogged — Agent execution contract

## Project identity and authority
Shopify catalog evidence-first observability: reconstruct original state, later authorized changes, propagation and first demonstrable divergence so that a merchant understands a meaningful catalog incident.

## Source hierarchy
- Commercial/product bets: https://app.notion.com/p/3b4cb152b27181a29d67d962d5c11abc
- Execution: https://linear.app/xsvlabs/project/cat-first-catalog-incident-bb4f4bb80feb
- Technical truth: repository main branch, exact commits, CI, migrations and deployments.
- Preserve the historic product-specific contracts and frozen acceptance fixtures. If conflict, stop and report rather than silently changing scope.

## Hard limits
Owner decision, 2026-11-17 ([XSV-152](https://linear.app/xsvlabs/issue/XSV-152/cat-merchant-discovery-continuation-signal-and-overdue-bet-decision)): continue technical development within the documented Catalogged project scope without bet/rebet or merchant-validation prerequisites. The original Aug 19 circuit breaker remains historical; no new bet is created. See [technical continuation](docs/technical-continuation.md) for priorities and evidence gaps.

Only read_products; never Shopify mutation, rollback, auto-remediation, billing, generative inference replacing evidence, cross-channel scraping or another platform. Real-store authentication, consent and merchant interest require actual evidence; technical authorization does not establish them. No standalone roadmap of SKU ideas. Production deployment and destructive actions require separate authorization.

## Before touching code
Read `docs/product-contract.md`, `docs/architecture.md`, `docs/development.md`, the active Linear issue and relevant existing domain contracts/tests. Check GitHub for an active PR of the same slice. State scope, untouched files and acceptance gate. Work in an isolated branch/worktree. Do not edit shared fixtures or migrate data unless explicitly approved. Open a draft PR; don't self-merge/deploy or claim customer validation. Coordinate Codex/Claude by non-overlapping ownership.

## Reusable procedures
- `.agents/skills/xsv-slice-delivery/SKILL.md`
- `.agents/skills/xsv-independent-review/SKILL.md`
