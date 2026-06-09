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
    expect(() =>
      readFileSync(join(donatedDir, "detached-proof.json")),
    ).not.toThrow();
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

  it("allows repo-authored canon that has no donated counterpart", () => {
    // The published tree carries canonical protocol documents the donation does
    // not (yet) ship (audit record, status list, needs-authorization). Their
    // $ids resolve to no donated schema, so the gate must NOT treat them as
    // drift — even when their bytes differ from anything donated. This is the
    // model: @kya-os/mcp donates a subset; this repo is the canonical superset.
    const mutated = donationSyncDiffs(repoRoot, {
      "audit/record/v1.0.0.json": JSON.stringify({
        $schema: "https://json-schema.org/draft/2020-12/schema",
        $id: "https://schema.kya-os.org/v1/protocol/audit/record/v1.0.0",
        title: "locally edited repo-authored canon",
      }),
    });
    expect(mutated).toEqual([]);
  });

  it("flags a donated schema with no published counterpart", () => {
    // Re-id the published well-known document so the donated well-known $id is
    // left with nothing to match — the gate must report the missing published
    // document, not pass silently (donation could otherwise add a schema the
    // published tree never gains).
    const reIded = JSON.stringify({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://schema.kya-os.ai/v1/protocol/well-known/v9.9.9",
    });
    const mutated = donationSyncDiffs(repoRoot, {
      "well-known/v1.0.0.json": reIded,
    });
    expect(
      mutated.some((d) => d.includes("has no published counterpart")),
    ).toBe(true);
  });

  it("fails when the published schema tree is missing or empty", () => {
    // Point at a repo root with no schemas/v1/protocol tree: nothing to compare,
    // so the gate must FAIL rather than exit clean with zero comparisons.
    const diffs = donationSyncDiffs(
      join(repoRoot, "__no_such_published_tree__"),
    );
    expect(diffs.some((d) => d.includes("no published schemas found"))).toBe(
      true,
    );
  });
});
