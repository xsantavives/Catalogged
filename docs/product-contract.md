# Catalogged — Product contract (agent entry point)

Shopify catalog evidence-first observability: reconstruct original state, later authorized changes, propagation and first demonstrable divergence so that a merchant understands a meaningful catalog incident.

## Non-negotiables
The owner's 2026-11-17 decision in [XSV-152](https://linear.app/xsvlabs/issue/XSV-152/cat-merchant-discovery-continuation-signal-and-overdue-bet-decision) authorizes continued technical development within the existing Catalogged project scope and retires bet/rebet and prior merchant validation as technical prerequisites. The original Aug 19 circuit breaker is historical, not extended. [Technical continuation](technical-continuation.md) records the inspected dependencies and evidence gaps.

Only read_products; never Shopify mutation, rollback, auto-remediation, billing, generative inference replacing evidence, cross-channel scraping or another platform. Real-store authentication, consent and merchant interest require actual evidence. No standalone roadmap of SKU ideas, production deployment or destructive actions authorized by this decision.

## Source hierarchy
- Commercial/product bets: https://app.notion.com/p/3b4cb152b27181a29d67d962d5c11abc
- Execution: https://linear.app/xsvlabs/project/cat-first-catalog-incident-bb4f4bb80feb
- Technical truth: repository main branch, exact commits, CI, migrations and deployments.
- Preserve the historic product-specific contracts and frozen acceptance fixtures. If conflict, stop and report rather than silently changing scope.

## Acceptance
A finished technical slice requires an authorized Linear scope, reproducible tests, an independently reviewed PR and explicit distinction between synthetic PASS, deployed proof and real customer evidence. No new Shape Up bet or prior merchant validation is required for technical development under XSV-152. Nothing in this file grants authority to expand the documented product scope or claim real-shop acceptance without evidence.
