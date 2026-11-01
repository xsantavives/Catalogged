# Catalogged — Agent execution contract

## Project identity and authority
Shopify catalog evidence-first observability: reconstruct original state, later authorized changes, propagation and first demonstrable divergence so that a merchant understands a meaningful catalog incident.

## Source hierarchy
- Commercial/product bets: https://app.notion.com/p/3b4cb152b27181a29d67d962d5c11abc
- Execution: https://linear.app/xsvlabs/project/cat-first-catalog-incident-bb4f4bb80feb
- Technical truth: repository main branch, exact commits, CI, migrations and deployments.
- Preserve the historic product-specific contracts and frozen acceptance fixtures. If conflict, stop and report rather than silently changing scope.

## Hard limits
Current bet CAT — First Catalog Incident expired its original Aug 19 circuit breaker; a new bounded explicit bet/reshape must precede product expansion. Only read_products; never Shopify mutation, rollback, auto-remediation, billing, generative inference replacing evidence, cross-channel scraping or another platform. Authenticate a real store and test merchant interest. No standalone roadmap of SKU ideas.

## Before touching code
Read `docs/product-contract.md`, `docs/architecture.md`, `docs/development.md`, the active Linear issue and relevant existing domain contracts/tests. Check GitHub for an active PR of the same slice. State scope, untouched files and acceptance gate. Work in an isolated branch/worktree. Do not edit shared fixtures or migrate data unless explicitly approved. Open a draft PR; don't self-merge/deploy or claim customer validation. Coordinate Codex/Claude by non-overlapping ownership.

## Reusable procedures
- `.agents/skills/xsv-slice-delivery/SKILL.md`
- `.agents/skills/xsv-independent-review/SKILL.md`
