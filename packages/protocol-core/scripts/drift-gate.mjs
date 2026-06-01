#!/usr/bin/env node
/**
 * Donation-sync drift gate.
 *
 * Verifies that the schemas published in this repository are byte-identical to
 * the schemas shipped by the donated @kya-os/mcp package. Exits non-zero with a
 * description of every mismatch, so a divergence fails CI rather than shipping a
 * published schema that has drifted from the donation.
 *
 * Run: node scripts/drift-gate.mjs   (or: pnpm run drift)
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, ".."); // packages/protocol-core
const repoRoot = join(here, "..", "..", "..");

const DONATION_MAP = {
  "delegation/credential/v1.0.0.json": "delegation-credential.json",
  "proof/detached/v1.0.0.json": "detached-proof.json",
  "handshake/request/v1.0.0.json": "handshake-request.json",
  "handshake/response/v1.0.0.json": "handshake-response.json",
  "well-known/v1.0.0.json": "well-known-mcpi.json",
};

// Resolve @kya-os/mcp from the package that declares it as a devDependency
// (pnpm installs it under packages/protocol-core/node_modules), not the root.
const require = createRequire(join(pkgRoot, "noop.js"));
const donatedDir = join(dirname(require.resolve("@kya-os/mcp/package.json")), "schemas");
const publishedDir = join(repoRoot, "schemas", "v1", "protocol");

const diffs = [];
for (const [rel, donatedName] of Object.entries(DONATION_MAP)) {
  const published = read(join(publishedDir, rel));
  const donated = read(join(donatedDir, donatedName));
  if (published === null) diffs.push(`published schema missing: ${rel}`);
  else if (donated === null) diffs.push(`donated schema missing: @kya-os/mcp/schemas/${donatedName}`);
  else if (published !== donated) diffs.push(`drift: ${rel} differs from donated @kya-os/mcp/schemas/${donatedName}`);
}

if (diffs.length > 0) {
  console.error("Schema drift gate FAILED:");
  for (const d of diffs) console.error(`  - ${d}`);
  process.exit(1);
}
console.log(`Schema drift gate passed: ${Object.keys(DONATION_MAP).length} schemas in sync with @kya-os/mcp.`);

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
