/* global process */
import {readFileSync} from "node:fs";
import {parse} from "smol-toml";
import {validateShopifyConfig} from "./shopify-config-contract.mjs";

try {
  const config = parse(readFileSync(process.argv[2] ?? "shopify.app.toml", "utf8"));
  const errors = validateShopifyConfig(config, process.env);
  if (errors.length) {
    process.stderr.write(`Shopify configuration contract FAILED:\n${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Local Shopify configuration contract PASS. Live identity, secret pairing, active grants and runtime remain unverified.\n");
  }
} catch {
  // Parser errors can contain input values; suppress them to avoid leaking secrets.
  process.stderr.write("Shopify configuration contract FAILED: cannot read or parse TOML.\n");
  process.exitCode = 1;
}
