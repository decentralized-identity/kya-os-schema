#!/usr/bin/env node
/**
 * Build the Cloudflare Pages deploy artifact that publishes the versioned
 * schema tree at https://schema.kya-os.org.
 *
 * Each schema is served both at its canonical (extensionless) `$id` path and at
 * the `.json` path, with `application/schema+json`, open CORS, and a cache
 * policy — the serving contract that external validators and `$ref` resolution
 * expect. A `schema-index.json` listing every published `$id` is emitted for
 * consumers that discover schemas programmatically.
 *
 * Output goes to `dist/` (gitignored); the deploy step uploads it to Pages.
 * Run: node scripts/build-pages.mjs   (or: pnpm run build:pages)
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const distDir = join(repoRoot, "dist");
const versionedTree = join(repoRoot, "schemas", "v1");

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
cpSync(versionedTree, join(distDir, "v1"), { recursive: true });

/** Recursively collect every `.json` file under a directory. */
function jsonFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...jsonFiles(full));
    else if (entry.endsWith(".json")) out.push(full);
  }
  return out;
}

const index = [];
for (const file of jsonFiles(join(distDir, "v1"))) {
  const raw = readFileSync(file, "utf8");
  // Serve the canonical extensionless `$id` path alongside the `.json` file so
  // a fetch of the bare `$id` resolves without relying on redirect precedence.
  writeFileSync(file.replace(/\.json$/, ""), raw);
  const parsed = JSON.parse(raw);
  if (typeof parsed.$id === "string") {
    index.push({
      $id: parsed.$id,
      title: typeof parsed.title === "string" ? parsed.title : null,
      path: "/" + relative(distDir, file).split(/[/\\]/).join("/"),
    });
  }
}
index.sort((a, b) => a.$id.localeCompare(b.$id));

writeFileSync(
  join(distDir, "schema-index.json"),
  JSON.stringify({ schemas: index }, null, 2) + "\n",
);

writeFileSync(
  join(distDir, "_headers"),
  [
    "/v1/*",
    "  Content-Type: application/schema+json",
    "  Access-Control-Allow-Origin: *",
    "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "/schema-index.json",
    "  Access-Control-Allow-Origin: *",
    "  Cache-Control: public, max-age=3600, s-maxage=86400",
    "",
  ].join("\n"),
);

writeFileSync(
  join(distDir, "index.html"),
  '<!doctype html>\n<meta charset="utf-8">\n<title>KYA-OS Protocol Schemas</title>\n' +
    "<h1>KYA-OS Protocol Schemas</h1>\n" +
    "<p>Versioned JSON Schemas (draft 2020-12) served at their canonical " +
    "<code>$id</code>. See <a href=\"/schema-index.json\">schema-index.json</a>.</p>\n",
);

console.log(`Built Pages artifact: ${index.length} schemas -> ${relative(repoRoot, distDir)}/`);
