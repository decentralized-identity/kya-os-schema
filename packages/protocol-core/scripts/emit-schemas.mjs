#!/usr/bin/env node
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ORIGIN = "https://schema.kya-os.org";
const PREFIX = "/v1/protocol/";

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const repoRoot = join(packageRoot, "..", "..");
const publishedRoot = join(repoRoot, "schemas", "v1", "protocol");
const require = createRequire(import.meta.url);

// The donation pin lives in one place: this package's exact devDependency.
const EXPECTED_DONATION_VERSION = JSON.parse(
  readFileSync(join(packageRoot, "package.json"), "utf8"),
).devDependencies["@kya-os/mcp"];
if (!/^\d+\.\d+\.\d+$/.test(EXPECTED_DONATION_VERSION)) {
  throw new Error(
    `@kya-os/mcp must be pinned to an exact version, found ${EXPECTED_DONATION_VERSION}`,
  );
}

// Audited in-place widenings: see in-place-transitions.json.
const { transitions } = JSON.parse(
  readFileSync(join(packageRoot, "in-place-transitions.json"), "utf8"),
);
const isAuditedTransition = (path, from, to) =>
  transitions.some((t) => t.path === path && t.from === from && t.to === to);

const donationPackagePath = require.resolve("@kya-os/mcp/package.json");
const donationPackage = JSON.parse(readFileSync(donationPackagePath, "utf8"));
const donationRoot = join(dirname(donationPackagePath), "schemas");

if (donationPackage.version !== EXPECTED_DONATION_VERSION) {
  throw new Error(
    `Expected @kya-os/mcp ${EXPECTED_DONATION_VERSION}, resolved ${donationPackage.version}`,
  );
}

const seenIds = new Set();
let emitted = 0;

for (const name of readdirSync(donationRoot).sort()) {
  if (!name.endsWith(".json")) continue;
  const source = join(donationRoot, name);
  const bytes = readFileSync(source, "utf8");
  const schema = JSON.parse(bytes);
  if (typeof schema.$id !== "string") continue;
  if (seenIds.has(schema.$id)) {
    throw new Error(`Duplicate donated schema $id: ${schema.$id}`);
  }
  seenIds.add(schema.$id);

  const id = new URL(schema.$id);
  if (id.origin !== ORIGIN || !id.pathname.startsWith(PREFIX)) {
    throw new Error(`Refusing non-canonical donated schema $id: ${schema.$id}`);
  }
  if (id.search || id.hash || !/\/v\d+\.\d+\.\d+$/.test(id.pathname)) {
    throw new Error(`Schema $id is not a versioned canonical path: ${schema.$id}`);
  }

  const relativePath = `${id.pathname.slice(PREFIX.length)}.json`;
  const target = join(publishedRoot, relativePath);
  if (existsSync(target)) {
    const publishedBytes = readFileSync(target, "utf8");
    if (publishedBytes !== bytes) {
      const currentDigest = sha256(publishedBytes);
      const donatedDigest = sha256(bytes);
      if (!isAuditedTransition(relativePath, currentDigest, donatedDigest)) {
        throw new Error(
          `Immutable schema conflict at ${relativePath} (${currentDigest} -> ${donatedDigest}); ` +
            "publish a new schema version, or record an audited compatible widening in in-place-transitions.json",
        );
      }
      writeFileSync(target, bytes);
    }
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  emitted += 1;
}

console.log(
  `Synchronized ${emitted} schemas from @kya-os/mcp ${donationPackage.version}.`,
);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
