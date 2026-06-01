import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Maps each published schema (relative to `schemas/v1/protocol/`) to the
 * file name it is shipped under inside the donated `@kya-os/mcp` package.
 * The donation is the canonical artifact; the published tree restates it at
 * `$id`-dictated paths. The drift gate exists to prove the two never diverge.
 */
const DONATION_MAP: Record<string, string> = {
  "delegation/credential/v1.0.0.json": "delegation-credential.json",
  "proof/detached/v1.0.0.json": "detached-proof.json",
  "handshake/request/v1.0.0.json": "handshake-request.json",
  "handshake/response/v1.0.0.json": "handshake-response.json",
  "well-known/v1.0.0.json": "well-known-mcpi.json",
};

/**
 * Resolve the `schemas/` directory inside the installed @kya-os/mcp package.
 * Resolution is anchored at this module's own location so it finds the
 * dependency under `packages/protocol-core/node_modules` regardless of the
 * caller's working directory.
 */
export function donatedSchemasDir(): string {
  const require = createRequire(fileURLToPath(import.meta.url));
  const pkgJson = require.resolve("@kya-os/mcp/package.json");
  return join(dirname(pkgJson), "schemas");
}

/**
 * Compare the published schema tree against the donated @kya-os/mcp schemas.
 *
 * Returns a list of human-readable mismatch descriptions; an empty list means
 * the published schemas are byte-identical to the donation. `overrides` lets a
 * caller substitute the *published* bytes for a given relative path without
 * touching disk — used by the gate's own tests to prove it bites on a mutation.
 */
export function donationSyncDiffs(
  repoRoot: string,
  overrides: Record<string, string> = {},
): string[] {
  const publishedDir = join(repoRoot, "schemas", "v1", "protocol");
  const donatedDir = donatedSchemasDir();
  const diffs: string[] = [];

  for (const [rel, donatedName] of Object.entries(DONATION_MAP)) {
    const published =
      rel in overrides
        ? overrides[rel]
        : safeRead(join(publishedDir, rel));
    const donated = safeRead(join(donatedDir, donatedName));

    if (published === null) {
      diffs.push(`published schema missing: ${rel}`);
      continue;
    }
    if (donated === null) {
      diffs.push(`donated schema missing: @kya-os/mcp/schemas/${donatedName}`);
      continue;
    }
    if (published !== donated) {
      diffs.push(
        `drift: published ${rel} differs from donated @kya-os/mcp/schemas/${donatedName}`,
      );
    }
  }

  return diffs;
}

function safeRead(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}
