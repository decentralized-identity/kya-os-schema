import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

/** The published catalog and the audit fixtures shared by every audit schema test. */
const here = dirname(fileURLToPath(import.meta.url));
const schemasRoot = join(
  here,
  "..",
  "..",
  "..",
  "..",
  "schemas",
  "v1",
  "protocol",
);
export const ORIGIN = "https://schema.kya-os.org";

export const published = jsonFiles(schemasRoot)
  .map((file) => ({
    file,
    relative: relative(schemasRoot, file).split(sep).join("/"),
    schema: JSON.parse(readFileSync(file, "utf8")) as Record<string, unknown>,
  }))
  .filter(({ schema }) => typeof schema.$id === "string");

export const byId = new Map(
  published.map(({ schema }) => [schema.$id as string, schema]),
);
export const auditId = (name: string) =>
  `${ORIGIN}/v1/protocol/audit/${name}/v1.0.0`;
export function catalogValidator() {
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  for (const { schema } of published) ajv.addSchema(schema);

  // Frozen @kya-os/mcp v1.11.0 audit-entry bytes contain this relative ref.
  // Register its public retrieval alias without changing the donated schema.
  const event = structuredClone(byId.get(auditId("event"))!);
  delete event.$id;
  ajv.addSchema(
    event,
    `${ORIGIN}/v1/protocol/audit/entry/audit-event.schema.json`,
  );
  return ajv;
}

export function envelopeFixture() {
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
    tenantRef: {
      kind: "keyed_commitment",
      value: digest("1"),
      keyId: "tenant-key",
    },
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
        selections: [
          {
            ledgerId: core.ledgerId,
            ledgerEpochId: core.ledgerEpochId,
            firstSequence: "0",
            lastSequence: "0",
            expectedHeadDigest: entry.entryDigest,
            checkpointTreeSizes: ["1"],
          },
        ],
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

export function digest(hex: string) {
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
