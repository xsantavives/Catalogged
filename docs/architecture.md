# Catalogged — Architecture and boundaries

Shopify embedded app in app/, React Router, Prisma persistence and Shopify read-only integration; follow docs/deployment-validation.md and any current scoped product docs. Do not infer identity from SKU/title ordering alone or a cause/actor without source evidence.

## Agent-safe boundaries
- Inspect the actual tree before editing. Architecture statements describing future G phases do not assert the code exists.
- One task = one isolated branch/worktree, no concurrent ownership of files, migrations or domain models.
- No new paid infrastructure, customer data, secrets, schema migrations or external permissions without acceptance in the issue and explicit approval.
- Scope changes trigger a new shaping/decision, not invisible agent initiative.

## Authoritative sources
See [product contract](product-contract.md) and linked Notion and Linear records. This document is a navigational adapter, not a replacement for deeper existing architectural specifications.
