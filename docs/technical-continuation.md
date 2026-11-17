# Catalogged technical continuation — 2026-11-17

## Authority and scope

The owner instructed: “avanza. nos dejamos de apuestas. Todo el desarrollo”. The decision is recorded at the start of [XSV-152](https://linear.app/xsvlabs/issue/XSV-152/cat-merchant-discovery-continuation-signal-and-overdue-bet-decision). It supersedes historical bet/rebet and prior merchant-validation prerequisites for technical development in project P-XSV-2. It does not extend the expired August bet, revive the former SKU roadmap, establish merchant evidence, or authorize production deployment or destructive operations.

Development remains Shopify-only, read-only and limited to `read_products`. No rollback, remediation, billing, speculative inference, external scraping, additional platform or broad policy engine. Outreach belongs to the founder; consent and store access require real permission. Existing frozen tests and evidence contracts remain intact.

## Inspected technical dependencies

Baseline: `42e24c7cd530df0c20a2520cf585d07779def231` on `main`. Linear project backlog, XSV-149–XSV-155 and XSV-158, and open PR file lists were inspected on 2026-11-17.

| Priority / existing scope | Observed state | Technical continuation |
| --- | --- | --- |
| XSV-150: runtime/configuration | PR #33 merged a configuration preflight and SDK HMAC tests. The issue is marked Done, but its latest delivery comment explicitly leaves live identity, grants, OAuth/session and real delivery unverified. Checked-in TOML still has placeholders. | Preserve the preflight. Verify the existing Render/Shopify installation once authorized access is accessible; no invented app identity or production configuration changes. |
| XSV-151 and XSV-154: retained evidence and reliability | Webhooks, immutable snapshots, timeline, structural comparisons and findings exist. Tests previously replaced ingestion or persistence at the signed-route boundary. | Prioritize signed delivery through real temporary SQLite, transaction failure/retry, deduplication, persistence across reconnects and deterministic bounded read models. This delivery implements the gaps demonstrated below. |
| XSV-153: shop isolation/security | Read models accept shop-scoped queries; replay lookup uses a globally unique delivery ID. | Reject shop/topic conflicts before duplicate processing. Prove negative read cases in the integrated path. Broader authenticated session/route isolation remains a separate technical slice. |
| XSV-149: identity-aware pricing | PR #24 and corrective PR #25 are open; neither is merged into this baseline. | Avoid their files and review history. Reconcile those PRs before pricing integration; ordinary product-change evidence does not depend on them. |
| XSV-155: onboarding/diagnostics | Existing overview, catalog and diagnostics routes exist. | Build on their actual behavior after persistence/runtime dependencies; no new configuration engine. |
| XSV-158–XSV-160: release/distribution | Release, privacy/support readiness and beta decisions remain documented work. | Technical preparation can proceed without a rebet. Publication, deployment and real-world acceptance remain separate authorized actions. |
| XSV-152, XSV-156, XSV-157, XSV-161: merchant learning | No interview, consent, continuation request or payment evidence established by this delivery. | Founder-led observations remain outstanding; keep favorable and contrary evidence separate from technical results. |

## This delivery: ingestion reliability

Four regression cases failed before the fix: a delivery ID reused across shops, reused across topics, a retry acting on stale RECEIVED state after another attempt committed, and a late failed attempt changing a successful receipt to FAILED.

Snapshot projection now uses an empty-update upsert inside the existing transaction. It preserves the first snapshot and receipt processing time on replay. Failure marking conditionally updates only receipts that are not already PROCESSED. The duplicate path rejects mismatched shop/topic before reusing any retained receipt. As required by the existing tests, same-shop/topic replays retain the original payload even if a later body differs; this change does not overwrite source evidence or introduce semantic event deduplication.

A concurrent six-delivery burst also reproduced SQLite connection timeouts with the interactive transaction. Submitting all three projection/processing/read queries as a sequential Prisma transaction removes the callback/query scheduling gap while preserving atomic rollback. The burst now completes with one receipt, one snapshot and one processing timestamp.

No schema/migration, shared fixture, UI, pricing-PR file, Shopify scope, TOML, deployment setting or dependency changes. Test migrations run only against a newly created temporary database, which is removed afterwards.

The new integration tests use the actual Shopify SDK HMAC authenticator and route action, real Prisma/SQLite persistence, and the existing timeline/finding/comparison services. Network calls fail the tests. Synthetic signing keys, payloads and shop domains are test-only. Deterministic scheduling hooks reproduce races around real storage operations; a concurrent duplicate burst also exercises the normal path. A SQLite trigger proves snapshot rollback when marking the receipt processed fails; reconnecting and replaying recovers it.

```sh
npm test -- app/tests/catalog-ingestion.integration.test.ts app/services/catalog-monitor.server.test.ts app/services/catalog-snapshot.server.test.ts app/tests/webhooks.products.test.ts app/tests/shopify-runtime-contract.test.ts app/services/catalog-timeline.server.test.ts app/services/catalog-diff.server.test.ts app/services/catalog-finding-activity.server.test.ts
npm run typecheck
npm run lint
npm run build
git diff --check
```

Verification on 2026-11-17: all 101 scoped tests passed (including 10 new integration cases); typecheck, lint, production build and diff check passed. These are local technical results with synthetic inputs.

## External evidence still outstanding

- No usable live app credentials or authenticated Shopify/Render session are available to this execution. The existing app's identity, matching secret, final URL, effective read-only grant, OAuth/session continuity and embedded runtime need authorized verification. Historical reports of health or opening the app are not a current verification receipt.
- Real Shopify delivery/restart and an authorized real-shop baseline/change require accessible store and operator permissions. Synthetic SDK/SQLite tests do not satisfy XSV-151's real-shop acceptance.
- Founder-provided consent, dated redacted observations and independent merchant interpretation remain absent from this delivery. No outreach was performed.
- Independent review of the delivered SHA and the owner's merge/release decision remain pending. No deployment or full-project completion is claimed.

## Official implementation references

- [Shopify: ignore duplicate webhooks](https://shopify.dev/docs/apps/build/webhooks/ignore-duplicates): deduplicate individual deliveries by `X-Shopify-Webhook-Id`; do not conflate it with event correlation.
- [Prisma 6 Client reference: upsert](https://www.prisma.io/docs/v6/orm/reference/prisma-client-reference#upsert) and [updateMany](https://www.prisma.io/docs/v6/orm/reference/prisma-client-reference#updatemany): reuse the unique projection without replacing its data and guard state transitions. Verified against the installed Prisma 6.19.3 client and temporary SQLite database.
- [Prisma 6 sequential transactions](https://www.prisma.io/docs/v6/orm/prisma-client/queries/transactions#sequential-prisma-client-operations): submit an array of Prisma queries to execute in order within one atomic transaction.
