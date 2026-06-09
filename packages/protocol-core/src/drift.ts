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
    if (id)
      donatedById.set(id, {
        content: readFileSync(file, "utf8"),
        name: relative(donatedDir, file),
      });
  }

  const publishedFiles = jsonFiles(publishedDir);

  // A missing/unreadable/empty published tree must FAIL the gate. Otherwise the
  // per-file comparison below has nothing to iterate and the gate exits clean
  // while publishing nothing — a silent pass that hides an absent tree.
  if (publishedFiles.length === 0) {
    diffs.push(
      `no published schemas found under schemas/v1/protocol (missing, unreadable, or empty tree)`,
    );
  }
  // Likewise, if donation resolution yields zero schemas there is nothing to
  // compare against — treat that as a failure, not a pass.
  if (donatedById.size === 0) {
    diffs.push(
      `no donated schemas resolved from @kya-os/mcp (donation lookup failed?)`,
    );
  }

  // Track which donated $ids were actually matched by a published document, so
  // we can require completeness in both directions below.
  const matchedDonatedIds = new Set<string>();

  for (const file of publishedFiles) {
    const rel = relative(publishedDir, file).split(sep).join("/");
    const published =
      rel in overrides ? overrides[rel] : readFileSync(file, "utf8");

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
    matchedDonatedIds.add(id);
    if (published !== donated.content) {
      diffs.push(
        `drift: published ${rel} differs from donated ${donated.name} (same $id ${id})`,
      );
    }
  }

  // Completeness: every donated schema MUST have a matching published document.
  // Without this, bumping @kya-os/mcp so the donation gains a schema would still
  // pass (the published files all match) while the published tree is missing the
  // new document entirely.
  for (const [id, donated] of donatedById) {
    if (!matchedDonatedIds.has(id)) {
      diffs.push(
        `donated schema $id ${id} (${donated.name}) has no published counterpart`,
      );
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
