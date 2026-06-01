import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { donationSyncDiffs } from "../src/drift.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const require = createRequire(import.meta.url);

/**
 * The donation-sync check is the keystone of this repository: the schemas
 * published here MUST stay byte-identical to the schemas shipped by the
 * donated @kya-os/mcp package. `donationSyncDiffs` returns the list of
 * mismatches (empty when in sync); these tests assert it reports clean today
 * and that it actually bites when a published byte changes.
 */
describe("donation-sync drift gate", () => {
  it("locates the donated @kya-os/mcp schemas directory", () => {
    const pkgJson = require.resolve("@kya-os/mcp/package.json");
    const donatedDir = join(dirname(pkgJson), "schemas");
    expect(() => readFileSync(join(donatedDir, "detached-proof.json"))).not.toThrow();
  });

  it("reports no drift between published schemas and the donated package", () => {
    const diffs = donationSyncDiffs(repoRoot);
    expect(diffs).toEqual([]);
  });

  it("bites when a published schema diverges from the donated source", () => {
    // Keep a valid, matching $id so the entry pairs with the donated schema,
    // but change the bytes — this exercises real content drift, not a parse miss.
    const tampered = JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://schema.kya-os.ai/v1/protocol/well-known/v1.0.0",
      title: "tampered",
    });
    const mutated = donationSyncDiffs(repoRoot, {
      "well-known/v1.0.0.json": tampered,
    });
    expect(mutated.length).toBeGreaterThan(0);
    expect(mutated[0]).toContain("well-known");
    expect(mutated[0]).toContain("drift");
  });

  it("flags a published schema whose $id matches no donated schema", () => {
    const orphan = JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://schema.kya-os.ai/v1/protocol/well-known/v9.9.9",
    });
    const mutated = donationSyncDiffs(repoRoot, {
      "well-known/v1.0.0.json": orphan,
    });
    expect(mutated.some((d) => d.includes("no donated schema"))).toBe(true);
  });
});
