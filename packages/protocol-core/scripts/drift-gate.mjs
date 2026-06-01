#!/usr/bin/env node
/**
 * Donation-sync drift gate.
 *
 * Verifies that the schemas published in this repository are byte-identical to
 * the schemas shipped by the donated @kya-os/mcp package, matched by `$id` (the
 * canonical identifier, robust to either side's incidental file naming). Exits
 * non-zero with a description of every mismatch, so a divergence fails CI rather
 * than shipping a published schema that has drifted from the donation.
 *
 * Run: node scripts/drift-gate.mjs   (or: pnpm run drift)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, ".."); // packages/protocol-core
const repoRoot = join(here, "..", "..", "..");

// Resolve @kya-os/mcp from the package that declares it as a devDependency
// (pnpm installs it under packages/protocol-core/node_modules), not the root.
const require = createRequire(join(pkgRoot, "noop.js"));
const donatedDir = join(dirname(require.resolve("@kya-os/mcp/package.json")), "schemas");
const publishedDir = join(repoRoot, "schemas", "v1", "protocol");

const donatedById = new Map();
for (const file of jsonFiles(donatedDir)) {
  const id = schemaId(file);
  if (id) donatedById.set(id, { content: readFileSync(file, "utf8"), name: relative(donatedDir, file) });
}

const diffs = [];
let checked = 0;
for (const file of jsonFiles(publishedDir)) {
  const rel = relative(publishedDir, file);
  const id = schemaId(file);
  if (!id) {
    diffs.push(`published schema has no $id: ${rel}`);
    continue;
  }
  const donated = donatedById.get(id);
  if (!donated) {
    diffs.push(`no donated schema with $id ${id} (published ${rel})`);
    continue;
  }
  checked++;
  if (readFileSync(file, "utf8") !== donated.content) {
    diffs.push(`drift: ${rel} differs from donated ${donated.name} (same $id ${id})`);
  }
}

if (diffs.length > 0) {
  console.error("Schema drift gate FAILED:");
  for (const d of diffs) console.error(`  - ${d}`);
  process.exit(1);
}
console.log(`Schema drift gate passed: ${checked} schemas in sync with @kya-os/mcp.`);

function jsonFiles(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsonFiles(full));
    else if (entry.endsWith(".json")) out.push(full);
  }
  return out;
}

function schemaId(path) {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed.$id === "string" ? parsed.$id : null;
  } catch {
    return null;
  }
}
