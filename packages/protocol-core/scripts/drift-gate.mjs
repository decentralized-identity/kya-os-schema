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
 * The comparison MIRRORS `donationSyncDiffs` in `src/drift.ts`, which the test
 * suite exercises (`test/drift-gate.test.ts`). The tests are the canonical
 * statement of the contract; keep this script's checks in lockstep with them.
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

const publishedFiles = jsonFiles(publishedDir);
const diffs = [];

// Index published schemas by $id. Files with no $id are NOT schemas under the
// donation contract (e.g. the JSON-LD `@context` document) — skip them; their
// correctness is covered by the schema test suite, not the drift gate.
const publishedById = new Map();
for (const file of publishedFiles) {
  const id = schemaId(file);
  if (id) publishedById.set(id, { content: readFileSync(file, "utf8"), rel: relative(publishedDir, file) });
}

// A missing/unreadable/empty published tree must FAIL the gate — otherwise the
// loop below has nothing to compare and the gate exits clean while publishing
// nothing (a silent pass that hides an absent tree).
if (publishedFiles.length === 0) {
  diffs.push(`no published schemas found under schemas/v1/protocol (missing, unreadable, or empty tree)`);
}
// Donation resolution yielding zero schemas is likewise a failure, not a pass.
if (donatedById.size === 0) {
  diffs.push(`no donated schemas resolved from @kya-os/mcp (donation lookup failed?)`);
}

// The donation is the source of truth for what MUST be mirrored. Iterate the
// donated schemas (not the published tree): every donated $id must have a
// byte-identical published counterpart — enforcing drift detection AND
// completeness — while ALLOWING the published tree to additionally carry
// repo-authored canonical documents the donation does not (yet) ship. Those
// have no donated $id, so they are simply not drift-checked here.
for (const [id, donated] of donatedById) {
  const published = publishedById.get(id);
  if (!published) {
    diffs.push(`donated schema $id ${id} (${donated.name}) has no published counterpart`);
    continue;
  }
  if (published.content !== donated.content) {
    diffs.push(`drift: published ${published.rel} differs from donated ${donated.name} (same $id ${id})`);
  }
}

if (diffs.length > 0) {
  console.error("Schema drift gate FAILED:");
  for (const d of diffs) console.error(`  - ${d}`);
  process.exit(1);
}
console.log(`Schema drift gate passed: ${donatedById.size} donated schemas in sync with @kya-os/mcp.`);

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
