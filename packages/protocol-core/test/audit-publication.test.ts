import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  auditAnchorReceiptSchema,
  auditObservationReceiptSchema,
  auditReplayBundleSchema,
  signedAuditCheckpointSchema,
  signedAuditEntrySchema,
} from "@kya-os/mcp/audit";
import { SCHEMA_BASE_URL, protocolSchemaId } from "../src/base-url.js";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const schemasRoot = join(repoRoot, "schemas", "v1", "protocol");
const ORIGIN = "https://schema.kya-os.org";
const require = createRequire(import.meta.url);
const donationPackage = require("@kya-os/mcp/package.json") as {
  version: string;
};

const published = jsonFiles(schemasRoot)
  .map((file) => ({
    file,
    relative: relative(schemasRoot, file).split(sep).join("/"),
    schema: JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>,
  }))
  .filter(({ schema }) => typeof schema.$id === "string");

const byId = new Map(
  published.map(({ schema }) => [schema.$id as string, schema]),
);
const auditId = (name: string) =>
  `${ORIGIN}/v1/protocol/audit/${name}/v1.0.0`;
const requiredAuditIds = [
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
].map(auditId);

describe("v1.11.0 audit schema publication", () => {
  it("pins the exact donated package release", () => {
    expect(donationPackage.version).toBe("1.11.0");
    expect(SCHEMA_BASE_URL).toBe(ORIGIN);
    expect(protocolSchemaId("audit", "event")).toBe(auditId("event"));
  });

  it("publishes every core and external-envelope artifact", () => {
    for (const id of requiredAuditIds) {
      expect(byId.has(id), `missing ${id}`).toBe(true);
    }
  });

  it("keeps every $id canonical and aligned to its public path", () => {
    const seen = new Set<string>();
    for (const { relative: path, schema } of published) {
      const id = schema.$id as string;
      expect(seen.has(id), `duplicate $id ${id}`).toBe(false);
      seen.add(id);
      expect(schema.$schema).toBe(
        "https://json-schema.org/draft/2020-12/schema",
      );
      expect(id).toBe(`${ORIGIN}/v1/protocol/${path.replace(/\.json$/, "")}`);
      expect(schema.title).toBeTypeOf("string");
    }
  });

  it("compiles the complete cross-referenced catalog", () => {
    const ajv = catalogValidator();
    for (const { schema } of published) {
      expect(
        ajv.getSchema(schema.$id as string),
        `schema did not compile: ${schema.$id as string}`,
      ).toBeTypeOf("function");
    }
  });

  it("matches runtime acceptance for signed external envelopes", () => {
    const ajv = catalogValidator();
    const fixture = envelopeFixture();
    const pairs = [
      [signedAuditEntrySchema, auditId("signed-entry"), fixture.entry],
      [signedAuditCheckpointSchema, auditId("signed-checkpoint"), fixture.checkpoint],
      [auditObservationReceiptSchema, auditId("observation"), fixture.observation],
      [auditAnchorReceiptSchema, auditId("anchor-receipt"), fixture.anchor],
      [auditReplayBundleSchema, auditId("replay-bundle"), fixture.bundle],
    ] as const;

    for (const [runtime, id, value] of pairs) {
      expect(runtime.safeParse(value).success, `runtime rejected ${id}`).toBe(true);
      expect(ajv.getSchema(id)?.(value), `published schema rejected ${id}`).toBe(true);
      const withUnknown = { ...value, unknownCriticalField: true };
      expect(runtime.safeParse(withUnknown).success, `runtime accepted unknown ${id}`).toBe(false);
      expect(ajv.getSchema(id)?.(withUnknown), `published schema accepted unknown ${id}`).toBe(false);
    }
  });

  it("enforces replay component inclusion and omission shapes", () => {
    const validate = catalogValidator().getSchema(auditId("bundle-component"));
    expect(validate).toBeTypeOf("function");
    expect(
      validate?.({
        path: "entries/0.json",
        mediaType: "application/json",
        disposition: "included",
        digest: digest("a"),
        size: "2",
        content: {},
      }),
    ).toBe(true);
    expect(
      validate?.({
        path: "evidence/0.json",
        mediaType: "application/json",
        disposition: "redacted",
        reasonCode: "policy_redaction",
        content: {},
      }),
    ).toBe(false);
  });

  it("publishes a strict committed ingest acknowledgement", () => {
    const validate = catalogValidator().getSchema(auditId("ingest-response"));
    const fixture = envelopeFixture();
    const response = {
      schema: auditId("ingest-response"),
      entry: fixture.entry,
      receipt: fixture.entry.recorderReceipt,
      verification: {
        schema: "valid",
        receiptSignature: "valid",
        tenantBinding: "valid",
        sourceBinding: "valid",
        ledgerChain: "committed",
      },
    };

    expect(validate).toBeTypeOf("function");
    expect(validate?.(response)).toBe(true);
    expect(
      validate?.({
        ...response,
        verification: { ...response.verification, ledgerChain: "pending" },
      }),
    ).toBe(false);
  });
});

function catalogValidator() {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  for (const { schema } of published) ajv.addSchema(schema);

  // Frozen @kya-os/mcp v1.11.0 audit-entry bytes contain this relative ref.
  // Register its public retrieval alias without changing the donated schema.
  const event = structuredClone(byId.get(auditId("event"))!);
  delete event.$id;
  ajv.addSchema(event, `${ORIGIN}/v1/protocol/audit/entry/audit-event.schema.json`);
  return ajv;
}

function envelopeFixture() {
  const signer = {
    did: "did:key:zRecorder",
    kid: "did:key:zRecorder#key-1",
    alg: "EdDSA",
  } as const;
  const event = {
    schema: auditId("event"),
    eventId: "event-1",
    eventType: "tool.call.completed",
    eventVersion: "1.0.0",
    binding: "urn:kya-os:audit-binding:mcp:2025-11-25",
    occurredAt: 1,
    tenantRef: { kind: "keyed_commitment", value: digest("1"), keyId: "tenant-key" },
    source: {
      producer: { kind: "pairwise_did", did: "did:key:zProducer" },
      sourceId: "mcp-server-1",
      sourceSequence: "1",
    },
    action: { category: "tool.call" },
    outcome: "succeeded",
    evidence: [],
    details: { family: "tool", phase: "completed", attempt: "1" },
    privacy: { classification: "internal", retentionClass: "audit-365d" },
  };
  const core = {
    schema: auditId("entry"),
    ledgerId: "ledger-1",
    ledgerEpochId: "epoch-1",
    sequence: "0",
    previousEntryDigest: null,
    recordedAt: 2,
    recorder: signer,
    eventDigest: digest("2"),
    event,
    evidenceManifestDigest: digest("3"),
    integritySuite: "KYA-AUDIT-JCS-SHA256-JWS-2026",
  };
  const receiptCore = {
    schema: auditId("receipt"),
    ledgerId: core.ledgerId,
    ledgerEpochId: core.ledgerEpochId,
    sequence: core.sequence,
    eventId: event.eventId,
    entryDigest: digest("4"),
    previousEntryDigest: null,
    recordedAt: core.recordedAt,
    recorder: signer,
    integritySuite: core.integritySuite,
  };
  const entry = {
    core,
    eventDigest: core.eventDigest,
    entryDigest: receiptCore.entryDigest,
    recorderReceipt: { core: receiptCore, jws: "header.payload.signature" },
  };
  const checkpointCore = {
    schema: auditId("checkpoint"),
    checkpointId: "checkpoint-1",
    ledgerId: core.ledgerId,
    ledgerEpochId: core.ledgerEpochId,
    treeSize: "1",
    firstSequence: "0",
    lastSequence: "0",
    rootDigest: digest("5"),
    headEntryDigest: entry.entryDigest,
    previousCheckpointDigest: null,
    createdAt: 3,
    issuer: signer,
    integritySuite: "KYA-AUDIT-RFC9162-SHA256-JWS-2026",
  };
  const checkpoint = {
    core: checkpointCore,
    checkpointDigest: digest("6"),
    jws: "header.payload.signature",
  };
  const observation = {
    core: {
      schema: auditId("observation"),
      observerId: "observer-1",
      observer: signer,
      ledgerId: core.ledgerId,
      ledgerEpochId: core.ledgerEpochId,
      checkpointDigest: checkpoint.checkpointDigest,
      treeSize: "1",
      observedAt: 4,
      previousObservationDigest: null,
    },
    observationDigest: digest("7"),
    jws: "header.payload.signature",
  };
  const anchor = {
    schema: auditId("anchor-receipt"),
    kind: "worm",
    providerId: "archive-1",
    checkpointDigest: checkpoint.checkpointDigest,
    issuedAt: 5,
  };
  const bundle = {
    manifest: {
      core: {
        schema: auditId("bundle-manifest"),
        bundleId: "bundle-1",
        formatVersion: "1.0.0",
        selections: [{
          ledgerId: core.ledgerId,
          ledgerEpochId: core.ledgerEpochId,
          firstSequence: "0",
          lastSequence: "0",
          expectedHeadDigest: entry.entryDigest,
          checkpointTreeSizes: ["1"],
        }],
        exporter: signer,
        purpose: "external-audit",
        exportedAt: 6,
        verificationPolicyDigest: digest("8"),
        inventory: [],
        integritySuite: "KYA-AUDIT-BUNDLE-JCS-SHA256-JWS-2026",
      },
      manifestDigest: digest("9"),
      jws: "header.payload.signature",
    },
    components: [],
  };
  return { entry, checkpoint, observation, anchor, bundle };
}

function digest(hex: string) {
  return `sha256:${hex.repeat(64)}`;
}

function jsonFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...jsonFiles(path));
    else if (name.endsWith(".json")) files.push(path);
  }
  return files;
}
