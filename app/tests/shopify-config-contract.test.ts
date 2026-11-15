import {execFileSync, spawnSync} from "node:child_process";
import {readFileSync, mkdtempSync, writeFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {parse} from "smol-toml";
import {describe, expect, it} from "vitest";
import {API_VERSION, AUTH_PREFIX, validateShopifyConfig} from "../../scripts/shopify-config-contract.mjs";

// Synthetic values belong only to tests; none identifies a deployable Shopify app.
const env = {
  SHOPIFY_API_KEY: "synthetic-test-identity",
  SHOPIFY_API_SECRET: "synthetic-test-secret",
  SHOPIFY_APP_URL: "https://config-test.catalogged.invalid",
  SCOPES: "read_products",
  DATABASE_URL: "file:./synthetic-test.sqlite",
};
const config = () => ({
  client_id: env.SHOPIFY_API_KEY,
  application_url: env.SHOPIFY_APP_URL,
  embedded: true,
  access_scopes: {scopes: "read_products"},
  auth: {redirect_urls: [`${env.SHOPIFY_APP_URL}${AUTH_PREFIX}/callback`]},
  webhooks: {api_version: API_VERSION},
});

describe("local Shopify configuration preflight", () => {
  it("accepts a coherent synthetic contract", () => {
    expect(validateShopifyConfig(config(), env)).toEqual([]);
  });

  it.each(Object.keys(env))("rejects missing and blank %s without a fallback", (key) => {
    for (const value of [undefined, "", "  "]) {
      expect(validateShopifyConfig(config(), {...env, [key]: value})).toContain(`${key}: required`);
    }
  });

  it.each(["https://example.com", "https://EXAMPLE.com.", "https://your-app-url.example.com", "http://config-test.catalogged.invalid",
    "https://config-test.catalogged.invalid/path", "https://user:password@config-test.catalogged.invalid",
    "https://config-test.catalogged.invalid?token=secret", "https://localhost", "not-a-url"])(
    "rejects invalid production origin %s", (url) => {
      const errors = validateShopifyConfig({...config(), application_url: url}, {...env, SHOPIFY_APP_URL: url});
      expect(errors).toContain("application_url: public HTTPS origin required; example URLs rejected");
      expect(errors).toContain("SHOPIFY_APP_URL: public HTTPS origin required; no fallback permitted");
    },
  );

  it("rejects mismatched app identities and origins without printing values", () => {
    const errors = validateShopifyConfig({...config(), client_id: "other-synthetic-identity",
      application_url: "https://other.catalogged.invalid"}, env);
    expect(errors).toContain("client_id: differs from SHOPIFY_API_KEY");
    expect(errors).toContain("application_url: differs from SHOPIFY_APP_URL");
    expect(errors.join("\n")).not.toContain("other-synthetic-identity");
    expect(errors.join("\n")).not.toContain(env.SHOPIFY_API_SECRET);
  });

  it.each(["write_products", "read_products,write_products", "read_products,read_orders", "", "read_products,read_products"])(
    "rejects scopes outside the exclusive read_products contract: %s", (scopes) => {
      const errors = validateShopifyConfig({...config(), access_scopes: {scopes}}, {...env, SCOPES: scopes});
      expect(errors).toContain("access_scopes.scopes: must be read_products only");
      expect(errors).toContain("SCOPES: must be read_products only");
    },
  );

  it.each([[], [`${env.SHOPIFY_APP_URL}/api/auth`], [`${env.SHOPIFY_APP_URL}/auth/unsupported`],
    ["https://other.catalogged.invalid/auth/callback"],
    [`${env.SHOPIFY_APP_URL}/auth/callback`, `${env.SHOPIFY_APP_URL}/api/auth`]])(
    "rejects unsupported or foreign redirects %j", (...redirects) => {
      // Each table entry is an array of redirect URLs.
      const errors = validateShopifyConfig({...config(), auth: {redirect_urls: redirects}}, env);
      expect(errors).toContain("auth.redirect_urls: must match application origin and /auth/callback");
    },
  );

  it("rejects missing sections, disabled embedding and an API version mismatch", () => {
    const errors = validateShopifyConfig({embedded: false}, env);
    expect(errors).toEqual(expect.arrayContaining([
      "embedded: must be true", "access_scopes.scopes: must be read_products only",
      "auth.redirect_urls: must match application origin and /auth/callback",
      "webhooks.api_version: must match server API version",
    ]));
    expect(validateShopifyConfig({...config(), webhooks: {api_version: "2026-10"}}, env))
      .toContain("webhooks.api_version: must match server API version");
    expect(validateShopifyConfig({...config(), access_scopes: {scopes: "read_products", optional_scopes: ["write_products"]}}, env))
      .toContain("access_scopes.optional_scopes: must not request additional permissions");
  });

  it("reports the actual repository placeholders instead of certifying deployment readiness", () => {
    const actual = parse(readFileSync("shopify.app.toml", "utf8"));
    expect(validateShopifyConfig(actual, env)).toEqual(expect.arrayContaining([
      "client_id: verified app identity required",
      "application_url: public HTTPS origin required; example URLs rejected",
      "auth.redirect_urls: must match application origin and /auth/callback",
    ]));
  });

  it("exits nonzero for the checked-in TOML and never dumps credentials", () => {
    const result = spawnSync(process.execPath, ["scripts/validate-shopify-config.mjs"], {
      env: {...process.env, ...env}, encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Shopify configuration contract FAILED");
    expect(result.stderr).not.toContain(env.SHOPIFY_API_SECRET);
    expect(result.stderr).not.toContain(env.SHOPIFY_API_KEY);
  });

  it("runs a synthetic CLI PASS and rejects malformed TOML without echoing its contents", () => {
    const dir = mkdtempSync(join(tmpdir(), "catalogged-config-"));
    const path = join(dir, "synthetic.toml");
    try {
      writeFileSync(path, `client_id = "${env.SHOPIFY_API_KEY}"\napplication_url = "${env.SHOPIFY_APP_URL}"\nembedded = true\n[access_scopes]\nscopes = "read_products"\n[auth]\nredirect_urls = ["${env.SHOPIFY_APP_URL}/auth/callback"]\n[webhooks]\napi_version = "${API_VERSION}"\n`);
      expect(execFileSync(process.execPath, ["scripts/validate-shopify-config.mjs", path], {
        env: {...process.env, ...env}, encoding: "utf8",
      })).toContain("runtime remain unverified");
      writeFileSync(path, `client_id = "${env.SHOPIFY_API_SECRET}`);
      const result = spawnSync(process.execPath, ["scripts/validate-shopify-config.mjs", path], {
        env: {...process.env, ...env}, encoding: "utf8",
      });
      expect(result.status).toBe(1);
      expect(result.stderr).toBe("Shopify configuration contract FAILED: cannot read or parse TOML.\n");
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});
