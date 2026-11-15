import {createHmac} from "node:crypto";
import {readFileSync} from "node:fs";
import {parse} from "smol-toml";
import {afterAll, beforeAll, describe, expect, it, vi} from "vitest";
import type {shopifyApp} from "@shopify/shopify-app-react-router/server";
import {API_VERSION, AUTH_PREFIX} from "../../scripts/shopify-config-contract.mjs";

const {captureConfig, findUnique, fetchRequest} = vi.hoisted(() => ({
  captureConfig: vi.fn(),
  findUnique: vi.fn().mockResolvedValue(null),
  fetchRequest: vi.fn(() => {throw new Error("Network access forbidden in synthetic contract tests");}),
}));
vi.mock("../db.server", () => ({prisma: {session: {
  count: vi.fn().mockResolvedValue(0), findUnique,
}}}));
vi.mock("@shopify/shopify-app-react-router/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@shopify/shopify-app-react-router/server")>();
  return {...actual, shopifyApp: (config: Parameters<typeof shopifyApp>[0]) => {
    captureConfig(config);
    return actual.shopifyApp(config);
  }};
});

const secret = "synthetic-hmac-secret-not-a-Shopify-credential";
let app: typeof import("../shopify.server");

beforeAll(async () => {
  vi.stubEnv("SHOPIFY_API_KEY", "synthetic-test-identity");
  vi.stubEnv("SHOPIFY_API_SECRET", secret);
  vi.stubEnv("SHOPIFY_APP_URL", "https://runtime-test.catalogged.invalid");
  vi.stubEnv("SCOPES", "read_products");
  vi.stubGlobal("fetch", fetchRequest);
  app = await import("../shopify.server");
});
afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("actual app configuration with real Shopify SDK and synthetic storage", () => {
  it("keeps the validator, TOML and registered auth route aligned with server configuration", () => {
    const options = captureConfig.mock.calls[0][0];
    const toml = parse(readFileSync("shopify.app.toml", "utf8"));
    expect(options.authPathPrefix).toBe(AUTH_PREFIX);
    expect(options.apiVersion).toBe(API_VERSION);
    expect(app.apiVersion).toBe(API_VERSION);
    expect(options.scopes).toEqual(["read_products"]);
    expect(toml.embedded).toBe(true);
    expect(toml.webhooks).toMatchObject({api_version: API_VERSION});
    expect(toml.access_scopes).toMatchObject({scopes: "read_products"});
    expect(readFileSync("app/routes/auth.$.tsx", "utf8")).toContain("authenticate.admin(request)");
    expect(readFileSync("app/routes.ts", "utf8")).toContain("flatRoutes()");
  });

  it("emits embedded frame headers using the real SDK", () => {
    const headers = new Headers();
    app.addDocumentResponseHeaders(new Request("https://runtime-test.catalogged.invalid/app?shop=synthetic.myshopify.com"), headers);
    expect(headers.get("Content-Security-Policy")).toContain("https://admin.shopify.com");
    expect(headers.get("Content-Security-Policy")).toContain("https://synthetic.myshopify.com");
  });

  const body = '{"id":42}';
  const sign = (payload: string, key = secret) => createHmac("sha256", key).update(payload).digest("base64");
  const request = (payload = body, hmac: string | undefined = sign(body)) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Shopify-Topic": "products/create",
      "X-Shopify-Shop-Domain": "synthetic.myshopify.com",
      "X-Shopify-API-Version": API_VERSION,
      "X-Shopify-Webhook-Id": "synthetic-delivery-1",
    };
    if (hmac !== undefined) headers["X-Shopify-Hmac-Sha256"] = hmac;
    return new Request("https://runtime-test.catalogged.invalid/webhooks/products/create", {
      method: "POST", headers, body: payload,
    });
  };

  it("accepts a valid HMAC through the real route action without network or database writes", async () => {
    const {createCatalogWebhookAction} = await import("../services/catalog-webhook-handler.server");
    const ingest = vi.fn().mockResolvedValue({duplicate: false});
    const action = createCatalogWebhookAction(app.authenticate.webhook, ingest);
    const req = request();
    expect((await action({request: req, params: {}, context: {}, url: new URL(req.url), pattern: new URL(req.url).pathname})).status).toBe(200);
    expect(ingest).toHaveBeenCalledWith({payload: {id: 42}, shop: "synthetic.myshopify.com", topic: "PRODUCTS_CREATE", webhookId: "synthetic-delivery-1"});
    expect(fetchRequest).not.toHaveBeenCalled();
  });

  it.each(["tampered-body", "wrong-secret", "missing-hmac", "malformed-hmac"])(
    "rejects %s before persistence or session lookup", async (scenario) => {
      const {createCatalogWebhookAction} = await import("../services/catalog-webhook-handler.server");
      const ingest = vi.fn();
      const action = createCatalogWebhookAction(app.authenticate.webhook, ingest);
      let req = request();
      if (scenario === "tampered-body") req = request('{"id":43}');
      if (scenario === "wrong-secret") req = request(body, sign(body, "wrong-synthetic-secret"));
      if (scenario === "missing-hmac") req.headers.delete("X-Shopify-Hmac-Sha256");
      if (scenario === "malformed-hmac") req = request(body, "not-a-signature");
      findUnique.mockClear();
      await expect(action({request: req, params: {}, context: {}, url: new URL(req.url), pattern: new URL(req.url).pathname}))
        .rejects.toMatchObject({status: scenario === "missing-hmac" ? 400 : 401});
      expect(ingest).not.toHaveBeenCalled();
      expect(findUnique).not.toHaveBeenCalled();
      expect(fetchRequest).not.toHaveBeenCalled();
    },
  );
});
