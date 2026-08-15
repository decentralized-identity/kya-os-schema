#!/usr/bin/env node
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const distDir = join(repoRoot, "dist");
const sourceDir = join(repoRoot, "schemas", "v1", "protocol");
const ORIGIN = "https://schema.kya-os.org";

const REQUIRED_AUDIT_IDS = [
  "event",
  "entry",
  "receipt",
  "signed-receipt",
  "signed-entry",
  "checkpoint",
  "signed-checkpoint",
  "observation",
  "anchor-receipt",
  "inclusion-proof",
  "consistency-proof",
  "bundle-inclusion-proof",
  "bundle-consistency-proof",
  "bundle-manifest",
  "signed-bundle-manifest",
  "bundle-component",
  "replay-bundle",
  "ingest-response",
  "verification-policy",
  "verification-report",
].map((name) => `${ORIGIN}/v1/protocol/audit/${name}/v1.0.0`);

assert(existsSync(distDir), "dist/ is missing; run build:pages first");
const index = JSON.parse(readFileSync(join(distDir, "schema-index.json"), "utf8"));
assert(index.registry === ORIGIN, "schema index registry origin is incorrect");
assert(Array.isArray(index.schemas), "schema index must contain a schemas array");

const sourceSchemas = jsonFiles(sourceDir)
  .map((file) => JSON.parse(readFileSync(file, "utf8")))
  .filter((schema) => typeof schema.$id === "string");
assert(
  index.schemas.length === sourceSchemas.length,
  `schema index has ${index.schemas.length} entries for ${sourceSchemas.length} source schemas`,
);

const indexedIds = new Set();
for (const schema of index.schemas) {
  assert(!indexedIds.has(schema.$id), `duplicate index $id: ${schema.$id}`);
  indexedIds.add(schema.$id);
  const id = new URL(schema.$id);
  assert(id.origin === ORIGIN, `non-canonical index origin: ${schema.$id}`);
  assert(schema.canonical === id.pathname, `canonical path mismatch: ${schema.$id}`);
  assert(schema.path === `${id.pathname}.json`, `raw path mismatch: ${schema.$id}`);
  assert(schema.mediaType === "application/schema+json", `media type mismatch: ${schema.$id}`);

  const canonical = join(distDir, schema.canonical.slice(1));
  const raw = join(distDir, schema.path.slice(1));
  assert(existsSync(canonical), `missing canonical route asset: ${schema.canonical}`);
  assert(existsSync(raw), `missing raw route asset: ${schema.path}`);
  assert(readFileSync(canonical, "utf8") === readFileSync(raw, "utf8"), `route bytes differ: ${schema.$id}`);
  assert(JSON.parse(readFileSync(raw, "utf8")).$id === schema.$id, `served $id mismatch: ${schema.$id}`);
}

for (const id of REQUIRED_AUDIT_IDS) {
  assert(indexedIds.has(id), `required audit schema is missing from discovery: ${id}`);
}

const donatedRefAlias = join(
  distDir,
  "v1/protocol/audit/entry/audit-event.schema.json",
);
assert(existsSync(donatedRefAlias), "donated audit-entry relative $ref alias is missing");
assert(
  JSON.parse(readFileSync(donatedRefAlias, "utf8")).$id ===
    `${ORIGIN}/v1/protocol/audit/event/v1.0.0`,
  "donated audit-entry relative $ref alias points at the wrong schema",
);

const headers = readFileSync(join(distDir, "_headers"), "utf8");
assert(headers.includes("/v1/*"), "schema route header rule is missing");
assert(headers.includes("application/schema+json"), "schema media type header is missing");

const workerPath = join(distDir, "_worker.js");
assert(existsSync(workerPath), "Cloudflare Pages worker is missing");
const worker = (await import(`${pathToFileURL(workerPath).href}?smoke=${Date.now()}`)).default;
const env = { ASSETS: { fetch: serveAsset } };
const knownPath = "/v1/protocol/audit/ingest-response/v1.0.0";
const known = await worker.fetch(new Request(`${ORIGIN}${knownPath}`), env);
assert(known.status === 200, `known route returned ${known.status}`);
assert(
  known.headers.get("content-type")?.startsWith("application/schema+json"),
  "known route did not return schema JSON",
);
assert((await known.json()).$id === `${ORIGIN}${knownPath}`, "known route returned the wrong schema");

const unknownPath = "/v1/protocol/audit/not-a-schema/v9.9.9";
const unknown = await worker.fetch(new Request(`${ORIGIN}${unknownPath}`), env);
assert(unknown.status === 404, `unknown route returned ${unknown.status}`);
assert(
  unknown.headers.get("content-type")?.startsWith("application/problem+json"),
  "unknown route did not return problem JSON",
);
const problem = await unknown.json();
assert(problem.status === 404, "problem response status field is incorrect");
assert(problem.instance === unknownPath, "problem response instance is incorrect");
assert(problem.type === `${ORIGIN}/problems/schema-not-found`, "problem response type is incorrect");

const unknownHead = await worker.fetch(
  new Request(`${ORIGIN}${unknownPath}`, { method: "HEAD" }),
  env,
);
assert(unknownHead.status === 404, "unknown HEAD route did not preserve 404");
assert((await unknownHead.text()) === "", "unknown HEAD route returned a body");

// The landing page and trailing-slash normalization must keep working through
// the known-path gate.
const root = await worker.fetch(new Request(`${ORIGIN}/`), env);
assert(root.status === 200, `root route returned ${root.status}`);
assert(root.headers.get("content-type")?.startsWith("text/html"), "root route did not return HTML");

const trailing = await worker.fetch(new Request(`${ORIGIN}${knownPath}/`), env);
assert(
  trailing.status === 200 || trailing.status === 404,
  `trailing-slash route returned unexpected ${trailing.status}`,
);

// A directory path with no document must fail closed, not serve the fallback.
const dirPath = "/v1/protocol/audit";
const dir = await worker.fetch(new Request(`${ORIGIN}${dirPath}`), env);
assert(dir.status === 404, `bare directory route returned ${dir.status} instead of 404`);
assert(
  dir.headers.get("content-type")?.startsWith("application/problem+json"),
  "bare directory route did not return problem JSON",
);

console.log(
  `Pages smoke passed: ${index.schemas.length} schemas, known-route JSON, unknown-route problem JSON.`,
);

async function serveAsset(request) {
  const pathname = new URL(request.url).pathname;
  const candidate = join(distDir, pathname === "/" ? "index.html" : pathname.slice(1));
  if (!existsSync(candidate) || statSync(candidate).isDirectory()) {
    // Match PRODUCTION behavior: the real Pages ASSETS binding never returns
    // 404 here — it serves the SPA-style index.html fallback with HTTP 200.
    // The worker must therefore fail closed on its own manifest; a mock that
    // returned 404 would hide exactly that bug (and did, historically).
    return new Response(readFileSync(join(distDir, "index.html")), {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  const contentType = pathname.startsWith("/v1/")
    ? "application/schema+json"
    : candidate.endsWith(".html") || pathname === "/"
      ? "text/html; charset=utf-8"
      : "application/octet-stream";
  return new Response(readFileSync(candidate), {
    status: 200,
    headers: { "Content-Type": contentType },
  });
}

function jsonFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...jsonFiles(path));
    else if (name.endsWith(".json")) files.push(path);
  }
  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
