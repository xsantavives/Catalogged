# CAT-150-CONFIG-CONTRACT — local configuration audit

This code-only delivery adds a local preflight and synthetic regression tests. It does not change `shopify.app.toml`, Render, app credentials, OAuth grants, application startup or deployment commands. A passing test suite is not a passing production preflight.

## Reproduce

```sh
npm ci
npx prisma generate
npm test -- app/tests/shopify-config-contract.test.ts app/tests/shopify-runtime-contract.test.ts
npm run config:validate
```

`config:validate` reads the checked-in TOML by default and the target environment's `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SCOPES` and `DATABASE_URL`. It requires explicit nonblank values, embedded mode, exactly `read_products`, matching app identity and HTTPS origins, `/auth/callback` on that origin, and webhook API `2025-10`. It rejects example URLs and unsupported callback paths. It prints field names and reasons without values; unreadable/malformed TOML produces a generic error because parser diagnostics may include input. Failure exits 1.

An already-authorized operator can run `npm run config:validate -- /absolute/path/to/verified-config.toml` in a securely supplied target environment. Do not paste credentials into shell commands or tickets. No dotenv file is loaded, configuration is never written, and no network requests are made. This command is an explicit local check, not an automatic startup or Shopify publication gate. Presence and equality checks cannot establish that a client ID is genuine or that its secret is paired correctly.

## Findings at base `71bc8cac2fd7b599ed4f8bd6db10f3eacc09bdbd`

| Contract | Repository evidence | Local conclusion |
| --- | --- | --- |
| App identity and URL | TOML has `replace-with-your-shopify-client-id`, `https://example.com` and example callback | Preflight must fail; no real ID is inferred or substituted |
| Embedded app | TOML `embedded=true`; installed React Router SDK derives `isEmbeddedApp=true` | Real SDK frame-header behavior covered with a synthetic shop |
| OAuth route | Server prefix `/auth`; `flatRoutes()` registers `auth.$.tsx`, which calls `authenticate.admin` | Installed SDK derives `${authPathPrefix}/callback`; `/api/auth` is incompatible |
| Read-only permissions | Server defaults, TOML and Render Blueprint declare `read_products` | SDK accepts broader environment scopes; explicit preflight rejects them, including additional optional scopes |
| URL and incomplete environment | Server passes empty defaults for missing credentials/URL; SDK rejects empty app URL but accepts example origins | Preflight requires all target variables and rejects example origins; no runtime guard changed |
| API version | Server `ApiVersion.October25`, TOML webhooks `2025-10` | Contract test ties validator constants to actual server options and TOML |
| Webhook authenticity | Existing tests mock webhook authentication | New tests use the real application SDK/authenticator and route handler; valid HMAC succeeds, altered body/wrong secret/missing or malformed signature fails before ingestion or session lookup |

All test identities, secrets, shops and payloads are explicitly synthetic and confined to tests. Database access is replaced with a session-read stub and ingestion spy; fetch throws if invoked. This proves the local HMAC boundary, not delivery from Shopify, persisted snapshots or merchant behavior.

## Remaining gates

The checked-in TOML intentionally remains unsuitable for publication. Reconcile the existing Skuard identity, URLs and active grants through separately authorized access. Live OAuth, session persistence/restart recovery, tenant isolation and authenticated embedded smoke remain BLOCKED_ACCESS/unverified for this delivery. Do not use the older deployment runbook's reinstall instructions as authorization for an external action.

Independent Claude Code review must use the immutable PR HEAD and `main:.blocks/review.md`, reconciling persisted GitHub reviews and repairs for this delivery first. Limits: two independent reviews, one Codex repair; no reserve-review Actions, paid fallback, merge or deploy. XSV-149/#24/#25 pricing and its consumed review rounds belong to a different delivery. No independent acceptance is claimed by this audit.
