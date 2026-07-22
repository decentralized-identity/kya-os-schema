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

const EXPECTED_DONATION_VERSION = "1.11.0";
const ORIGIN = "https://schema.kya-os.org";
const PREFIX = "/v1/protocol/";
const ONE_TIME_DONATION_MIGRATIONS = new Map([
  [
    "well-known/v1.0.0.json",
    {
      from: "5801be64d9e4967c88f1c49c38b906cbecd858d59c3cc103e42443e7ea1d27dc",
      to: "a728e17e5ad24e754723d92d296962805eb3272b4fadc26442e96477358ad407",
    },
  ],
]);

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(here, "..");
const repoRoot = join(packageRoot, "..", "..");
const publishedRoot = join(repoRoot, "schemas", "v1", "protocol");
const require = createRequire(import.meta.url);
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
      const migration = ONE_TIME_DONATION_MIGRATIONS.get(relativePath);
      const currentDigest = sha256(publishedBytes);
      const donatedDigest = sha256(bytes);
      if (
        migration?.from !== currentDigest ||
        migration.to !== donatedDigest
      ) {
        throw new Error(
          `Immutable schema conflict at ${relativePath}; publish a new schema version instead`,
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
