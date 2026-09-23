import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The in-place transition ledger is the only exception to "immutable at its
 * $id". These checks keep it an audit record and not a bypass: every entry is
 * one exact, well-formed transition; the entries for a path chain in order;
 * and the chain ends at the bytes actually published.
 */
const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const publishedRoot = join(packageRoot, "..", "..", "schemas", "v1", "protocol");

interface Transition {
  path: string;
  from: string;
  to: string;
  upstream: string;
  reason: string;
}
const { transitions } = JSON.parse(
  readFileSync(join(packageRoot, "in-place-transitions.json"), "utf8"),
) as { transitions: Transition[] };

const SHA256 = /^[0-9a-f]{64}$/;
const sha256 = (bytes: string): string => createHash("sha256").update(bytes).digest("hex");

const byPath = new Map<string, Transition[]>();
for (const t of transitions) byPath.set(t.path, [...(byPath.get(t.path) ?? []), t]);

describe("in-place transition ledger", () => {
  it("records each transition exactly: path, both digests, upstream release, and a reason", () => {
    expect(transitions.length).toBeGreaterThan(0);
    for (const t of transitions) {
      expect(t.path, JSON.stringify(t)).toMatch(/^[a-z0-9/-]+\/v\d+\.\d+\.\d+\.json$/);
      expect(t.from, t.path).toMatch(SHA256);
      expect(t.to, t.path).toMatch(SHA256);
      expect(t.from, t.path).not.toBe(t.to);
      expect(t.upstream, t.path).toMatch(/^\d+\.\d+\.\d+$/);
      expect(t.reason.trim().length, t.path).toBeGreaterThan(20);
    }
  });

  it("chains the transitions for each path in order, with no fork and no repeat", () => {
    for (const [path, chain] of byPath) {
      const froms = chain.map((t) => t.from);
      expect(new Set(froms).size, `${path}: two transitions leave the same digest`).toBe(froms.length);
      for (let i = 1; i < chain.length; i++) {
        expect(chain[i].from, `${path}: entry ${i} does not start where entry ${i - 1} ended`).toBe(
          chain[i - 1].to,
        );
      }
    }
  });

  it("ends every chain at the published bytes, so the ledger cannot drift from what is served", () => {
    for (const [path, chain] of byPath) {
      const file = join(publishedRoot, path);
      expect(existsSync(file), `${path} is not published`).toBe(true);
      expect(sha256(readFileSync(file, "utf8")), path).toBe(chain[chain.length - 1].to);
    }
  });
});
