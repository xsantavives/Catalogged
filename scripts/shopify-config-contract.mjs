/* global URL */
// Local preflight only. This does not inspect Shopify's active version or grants.
export const AUTH_PREFIX = "/auth";
export const API_VERSION = "2025-10";

/** @param {unknown} value */
function isPresent(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** @param {unknown} value */
function isPlaceholder(value) {
  return typeof value === "string" && /replace-with|your[-_]app|your[-_]shopify/i.test(value);
}

/** @param {unknown} value */
function isOrigin(value) {
  if (!isPresent(value) || isPlaceholder(value)) return false;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" && !url.username && !url.password &&
      url.pathname === "/" && !url.search && !url.hash &&
      !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname) &&
      !/(^|\.)example\.(com|org|net)$/.test(url.hostname.replace(/\.$/, ""));
  } catch {
    return false;
  }
}

/** @param {unknown} value */
function isReadOnly(value) {
  return typeof value === "string" && value.trim() === "read_products";
}

/**
 * Return field names/reasons only, never configuration values or credentials.
 * @param {Record<string, unknown>} config Parsed Shopify app TOML
 * @param {Record<string, string | undefined>} env Explicit target environment
 */
export function validateShopifyConfig(config, env) {
  /** @type {string[]} */
  const errors = [];
  for (const key of ["SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "SHOPIFY_APP_URL", "SCOPES", "DATABASE_URL"]) {
    if (!isPresent(env[key])) errors.push(`${key}: required`);
  }
  if (!isPresent(config.client_id) || isPlaceholder(config.client_id)) {
    errors.push("client_id: verified app identity required");
  }
  if (isPlaceholder(env.SHOPIFY_API_KEY)) errors.push("SHOPIFY_API_KEY: placeholder rejected");
  if (isPresent(env.SHOPIFY_API_KEY) && config.client_id !== env.SHOPIFY_API_KEY) {
    errors.push("client_id: differs from SHOPIFY_API_KEY");
  }
  if (config.embedded !== true) errors.push("embedded: must be true");
  if (!isOrigin(config.application_url)) errors.push("application_url: public HTTPS origin required; example URLs rejected");
  if (!isOrigin(env.SHOPIFY_APP_URL)) errors.push("SHOPIFY_APP_URL: public HTTPS origin required; no fallback permitted");
  if (isOrigin(config.application_url) && isOrigin(env.SHOPIFY_APP_URL) &&
      new URL(String(config.application_url)).origin !== new URL(String(env.SHOPIFY_APP_URL)).origin) {
    errors.push("application_url: differs from SHOPIFY_APP_URL");
  }
  const scopes = /** @type {{scopes?: unknown, optional_scopes?: unknown} | undefined} */ (config.access_scopes);
  if (!isReadOnly(scopes?.scopes)) errors.push("access_scopes.scopes: must be read_products only");
  if (scopes?.optional_scopes !== undefined &&
      (!Array.isArray(scopes.optional_scopes) || scopes.optional_scopes.some((scope) => scope !== "read_products"))) {
    errors.push("access_scopes.optional_scopes: must not request additional permissions");
  }
  if (!isReadOnly(env.SCOPES)) errors.push("SCOPES: must be read_products only");
  const auth = /** @type {{redirect_urls?: unknown} | undefined} */ (config.auth);
  const redirects = auth?.redirect_urls;
  if (!Array.isArray(redirects) || !redirects.length || !isOrigin(config.application_url) ||
      redirects.some((url) => url !== `${new URL(String(config.application_url)).origin}${AUTH_PREFIX}/callback`)) {
    errors.push("auth.redirect_urls: must match application origin and /auth/callback");
  }
  const webhooks = /** @type {{api_version?: unknown} | undefined} */ (config.webhooks);
  if (webhooks?.api_version !== API_VERSION) errors.push("webhooks.api_version: must match server API version");
  return errors;
}
