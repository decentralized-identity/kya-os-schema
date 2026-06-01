import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

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

/** Recursively collect `.json` file paths under a directory. */
function jsonFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
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

/** Read a schema's `$id`, or null if the file is unreadable / has none. */
function schemaId(path: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as { $id?: string };
    return typeof parsed.$id === "string" ? parsed.$id : null;
  } catch {
    return null;
  }
}

/**
 * Compare the published schema tree against the donated @kya-os/mcp schemas,
 * keyed by `$id` (the canonical identifier — robust to either side's incidental
 * file naming).
 *
 * Returns a list of human-readable mismatch descriptions; an empty list means
 * every published schema is byte-identical to the donated schema bearing the
 * same `$id`. `overrides` substitutes the *published* bytes for a given path
 * (relative to `schemas/v1/protocol/`, using `/` separators) without touching
 * disk — used by the gate's own tests to prove it bites on a mutation.
 */
export function donationSyncDiffs(
  repoRoot: string,
  overrides: Record<string, string> = {},
): string[] {
  const publishedDir = join(repoRoot, "schemas", "v1", "protocol");
  const donatedDir = donatedSchemasDir();
  const diffs: string[] = [];

  // Index donated schemas by $id.
  const donatedById = new Map<string, { content: string; name: string }>();
  for (const file of jsonFiles(donatedDir)) {
    const id = schemaId(file);
    if (id) donatedById.set(id, { content: readFileSync(file, "utf8"), name: relative(donatedDir, file) });
  }

  for (const file of jsonFiles(publishedDir)) {
    const rel = relative(publishedDir, file).split(sep).join("/");
    const published = rel in overrides ? overrides[rel] : readFileSync(file, "utf8");

    const id = rel in overrides ? safeId(published) : schemaId(file);
    if (!id) {
      diffs.push(`published schema has no $id: ${rel}`);
      continue;
    }
    const donated = donatedById.get(id);
    if (!donated) {
      diffs.push(`no donated schema with $id ${id} (published ${rel})`);
      continue;
    }
    if (published !== donated.content) {
      diffs.push(`drift: published ${rel} differs from donated ${donated.name} (same $id ${id})`);
    }
  }

  return diffs;
}

function safeId(content: string): string | null {
  try {
    const parsed = JSON.parse(content) as { $id?: string };
    return typeof parsed.$id === "string" ? parsed.$id : null;
  } catch {
    return null;
  }
}
