import {createHmac} from "node:crypto";
import {execFileSync} from "node:child_process";
import {rmSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {prisma} from "../db.server";
import {canonicalJson, ingestCatalogWebhook, payloadHash} from "../services/catalog-monitor.server";
import {queryCatalogStructuralDiff} from "../services/catalog-diff.server";
import {queryCatalogFindingActivity} from "../services/catalog-finding-activity.server";
import {queryCatalogTimeline} from "../services/catalog-timeline.server";

const {directory, databaseUrl, interleave} = await vi.hoisted(async () => {
  const {mkdtempSync} = await import("node:fs");
  const {tmpdir} = await import("node:os");
  const {join} = await import("node:path");
  const directory = mkdtempSync(join(tmpdir(), "catalogged-ingestion-test-"));
  return {directory, databaseUrl: `file:${join(directory, "catalog.sqlite")}`, interleave: {
    afterReceiptRead: undefined as (() => Promise<void>) | undefined,
    beforeTransaction: undefined as (() => Promise<void>) | undefined,
  }};
});

vi.mock("../db.server", async () => {
  const {PrismaClient} = await import("@prisma/client");
  const client = new PrismaClient({datasourceUrl: databaseUrl});
  // Keep all storage real, with hooks solely to schedule competing attempts deterministically.
  const receipts = new Proxy(client.catalogWebhook, {get(target, property) {
    if (property === "findUnique") return async (...args: Parameters<typeof target.findUnique>) => {
      const record = await target.findUnique(...args);
      const hook = interleave.afterReceiptRead;
      interleave.afterReceiptRead = undefined;
      await hook?.();
      return record;
    };
    return Reflect.get(target, property);
  }});
  return {prisma: new Proxy(client, {get(target, property) {
    if (property === "catalogWebhook") return receipts;
    if (property === "$transaction") return async (...args: Parameters<typeof target.$transaction>) => {
      const hook = interleave.beforeTransaction;
      interleave.beforeTransaction = undefined;
      await hook?.();
      return target.$transaction(...args);
    };
    return Reflect.get(target, property);
  }})};
});

const secret = "synthetic-ingestion-test-secret";
const shop = "synthetic.myshopify.com";
const delivery = {
  webhookId: "synthetic-update", shop, topic: "PRODUCTS_UPDATE",
  payload: {id: 42, title: "Original", updated_at: "2026-11-17T10:00:00Z"},
};
let action: typeof import("../services/catalog-webhook-handler.server").handleCatalogWebhook;

async function deliver(input = delivery, validSignature = true) {
  const body = JSON.stringify(input.payload);
  const request = new Request("https://ingestion.catalogged.invalid/webhooks/products/update", {
    method: "POST", body,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Topic": input.topic.toLowerCase().replace("_", "/"),
      "X-Shopify-Shop-Domain": input.shop,
      "X-Shopify-API-Version": "2025-10",
      "X-Shopify-Webhook-Id": input.webhookId,
      "X-Shopify-Hmac-Sha256": createHmac("sha256", validSignature ? secret : "wrong-secret")
        .update(body).digest("base64"),
    },
  });
  return action({request, params: {}, context: {}, url: new URL(request.url), pattern: new URL(request.url).pathname});
}

async function received() {
  return prisma.catalogWebhook.create({data: {
    webhookId: delivery.webhookId, shop, topic: delivery.topic, resourceType: "PRODUCT",
    resourceId: "42", payload: canonicalJson(delivery.payload), payloadHash: payloadHash(delivery.payload),
    occurredAt: new Date(delivery.payload.updated_at),
  }});
}

beforeAll(async () => {
  vi.stubEnv("SHOPIFY_API_KEY", "synthetic-ingestion-test-key");
  vi.stubEnv("SHOPIFY_API_SECRET", secret);
  vi.stubEnv("SHOPIFY_APP_URL", "https://ingestion.catalogged.invalid");
  vi.stubEnv("SCOPES", "read_products");
  vi.stubGlobal("fetch", vi.fn(() => {throw new Error("Network forbidden in ingestion tests");}));
  // Apply existing migrations only to this test's newly created temporary database.
  execFileSync(process.execPath, [fileURLToPath(new URL("../../node_modules/prisma/build/index.js", import.meta.url)),
    "migrate", "deploy"], {env: {...process.env, DATABASE_URL: databaseUrl}, stdio: "pipe"});
  action = (await import("../services/catalog-webhook-handler.server")).handleCatalogWebhook;
}, 30_000);

beforeEach(async () => {
  await prisma.catalogSnapshot.deleteMany();
  await prisma.catalogWebhook.deleteMany();
});

afterEach(async () => {
  vi.restoreAllMocks();
  interleave.afterReceiptRead = undefined;
  interleave.beforeTransaction = undefined;
  await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS "fail_processing"');
});

afterAll(async () => {
  await prisma.$disconnect();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  rmSync(directory, {recursive: true, force: true});
});

describe("synthetic signed delivery with real SQLite persistence", () => {
  it("reconstructs a change after reconnecting and keeps replays immutable and shop-isolated", async () => {
    const baseline = {...delivery, webhookId: "synthetic-baseline", topic: "PRODUCTS_CREATE"};
    expect((await deliver(baseline)).status).toBe(200);
    const original = await prisma.catalogSnapshot.findFirstOrThrow({where: {shop}});
    await prisma.$disconnect();

    const change = {...delivery, payload: {...delivery.payload, title: "Changed", updated_at: "2026-11-17T11:00:00Z"}};
    expect((await deliver(change)).status).toBe(200);
    const current = await prisma.catalogSnapshot.findFirstOrThrow({where: {sourceTopic: "PRODUCTS_UPDATE"}});
    const diff = await queryCatalogStructuralDiff(shop, "PRODUCT", "42", current.id);
    expect(diff).toMatchObject({status: "COMPARABLE", previousSnapshotId: original.id,
      entries: expect.arrayContaining([{path: "/title", operation: "CHANGED", before: "Original", after: "Changed"}])});
    const timeline = await queryCatalogTimeline(shop, {limit: 1});
    expect(timeline).toMatchObject({entries: [{id: current.id}], hasNextPage: true});
    expect((await queryCatalogTimeline(shop, {limit: 1, cursor: timeline.nextCursor})).entries)
      .toMatchObject([{id: original.id}]);
    expect((await queryCatalogFindingActivity(shop)).entries).toMatchObject([{
      currentSnapshotId: current.id, findings: [{code: "PRODUCT_IDENTITY_CHANGED"}],
    }]);
    expect((await deliver(change)).status).toBe(200);
    // A reused delivery ID never replaces the first retained source payload.
    expect((await deliver({...change, payload: {...change.payload, title: "Replay alteration"}})).status).toBe(200);
    expect(await prisma.catalogSnapshot.findUnique({where: {id: original.id}})).toEqual(original);
    expect(await prisma.catalogSnapshot.findUnique({where: {id: current.id}})).toEqual(current);
    expect(await prisma.catalogWebhook.count()).toBe(2);
    expect(await prisma.catalogSnapshot.count()).toBe(2);
    expect(await queryCatalogStructuralDiff("other.myshopify.com", "PRODUCT", "42", current.id)).toBeUndefined();
    expect((await queryCatalogTimeline("other.myshopify.com")).entries).toEqual([]);
    expect((await queryCatalogFindingActivity("other.myshopify.com")).entries).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid HMAC before persisting a receipt or snapshot", async () => {
    await expect(deliver(delivery, false)).rejects.toMatchObject({status: 401});
    expect(await prisma.catalogWebhook.count()).toBe(0);
    expect(await prisma.catalogSnapshot.count()).toBe(0);
  });

  it.each([
    ["shop", "RECEIVED"], ["topic", "RECEIVED"], ["shop", "PROCESSED"], ["topic", "PROCESSED"],
  ] as const)("rejects a duplicate ID with a different %s in %s without altering evidence", async (field, state) => {
    if (state === "PROCESSED") await ingestCatalogWebhook(delivery);
    else await received();
    const original = await prisma.catalogWebhook.findUniqueOrThrow({where: {webhookId: delivery.webhookId}});
    const snapshots = await prisma.catalogSnapshot.findMany();
    const conflict = {...delivery, [field]: field === "shop" ? "other.myshopify.com" : "PRODUCTS_CREATE"};
    await expect(ingestCatalogWebhook(conflict)).rejects.toThrow("Webhook identity conflict");
    expect(await prisma.catalogWebhook.findUnique({where: {id: original.id}})).toEqual(original);
    expect(await prisma.catalogSnapshot.findMany()).toEqual(snapshots);
  });

  it("converges concurrent duplicate deliveries to one receipt and immutable snapshot", async () => {
    const results = await Promise.all(Array.from({length: 6}, () => ingestCatalogWebhook(delivery)));
    expect(results.every(({record}) => record.state === "PROCESSED")).toBe(true);
    expect(new Set(results.map(({record}) => record.processedAt?.toISOString())).size).toBe(1);
    expect(await prisma.catalogWebhook.count()).toBe(1);
    expect(await prisma.catalogSnapshot.count()).toBe(1);
  });

  it("rolls back snapshot creation on processing failure and recovers after reconnecting", async () => {
    await prisma.$executeRawUnsafe(`CREATE TRIGGER "fail_processing" BEFORE UPDATE ON "CatalogWebhook"
      WHEN NEW."state" = 'PROCESSED' BEGIN SELECT RAISE(ABORT, 'synthetic processing failure'); END`);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect((await deliver()).status).toBe(500);
    const failed = await prisma.catalogWebhook.findUniqueOrThrow({where: {webhookId: delivery.webhookId}});
    expect(failed.state).toBe("FAILED");
    expect(failed.processedAt).toBeNull();
    expect(await prisma.catalogSnapshot.count()).toBe(0);
    await prisma.$executeRawUnsafe('DROP TRIGGER "fail_processing"');
    await prisma.$disconnect();
    expect((await deliver()).status).toBe(200);
    expect(await prisma.catalogWebhook.findUnique({where: {id: failed.id}}))
      .toMatchObject({state: "PROCESSED", error: null, processedAt: expect.any(Date)});
    expect(await prisma.catalogSnapshot.count()).toBe(1);
  });

  it("accepts a stale RECEIVED retry after another delivery has completed processing", async () => {
    await received();
    // Deterministic interleaving: the second processor finishes after the first reads RECEIVED.
    interleave.afterReceiptRead = async () => {
      await ingestCatalogWebhook(delivery);
    };
    await expect(ingestCatalogWebhook(delivery)).resolves.toMatchObject({duplicate: true, record: {state: "PROCESSED"}});
    expect(await prisma.catalogSnapshot.count()).toBe(1);
    expect((await prisma.catalogWebhook.findUniqueOrThrow({where: {webhookId: delivery.webhookId}})).state).toBe("PROCESSED");
  });

  it("does not let a late failed attempt downgrade another attempt's committed success", async () => {
    interleave.beforeTransaction = async () => {
      await ingestCatalogWebhook(delivery);
      throw new Error("synthetic late transaction failure");
    };
    await expect(ingestCatalogWebhook(delivery)).rejects.toThrow("synthetic late transaction failure");
    expect(await prisma.catalogSnapshot.count()).toBe(1);
    expect(await prisma.catalogWebhook.findUnique({where: {webhookId: delivery.webhookId}}))
      .toMatchObject({state: "PROCESSED", error: null, processedAt: expect.any(Date)});
  });
});
