import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditAnchorReceiptSchema,
  auditObservationReceiptSchema,
  auditReplayBundleSchema,
  signedAuditCheckpointSchema,
  signedAuditEntrySchema,
} from "@kya-os/mcp/audit";
import {
  ORIGIN,
  auditId,
  byId,
  catalogValidator,
  digest,
  envelopeFixture,
  published,
} from "./support/audit-catalog.js";
import { SCHEMA_BASE_URL, protocolSchemaId } from "../src/base-url.js";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const donationPackage = require("@kya-os/mcp/package.json") as {
  version: string;
};

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
  "head-request",
  "head-response",
  "list-entries-request",
  "list-entries-response",
  "inclusion-proof-request",
  "inclusion-proof-response",
  "consistency-proof-request",
  "consistency-proof-response",
  "deployment-binding",
].map(auditId);

describe("donated audit schema publication", () => {
  it("pins the exact donated package release", () => {
    // The pin lives in package.json alone; the resolved package must match it.
    expect(donationPackage.version).toBe(
      JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"))
        .devDependencies["@kya-os/mcp"],
    );
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
      [
        signedAuditCheckpointSchema,
        auditId("signed-checkpoint"),
        fixture.checkpoint,
      ],
      [
        auditObservationReceiptSchema,
        auditId("observation"),
        fixture.observation,
      ],
      [auditAnchorReceiptSchema, auditId("anchor-receipt"), fixture.anchor],
      [auditReplayBundleSchema, auditId("replay-bundle"), fixture.bundle],
    ] as const;

    for (const [runtime, id, value] of pairs) {
      expect(runtime.safeParse(value).success, `runtime rejected ${id}`).toBe(
        true,
      );
      expect(
        ajv.getSchema(id)?.(value),
        `published schema rejected ${id}`,
      ).toBe(true);
      const withUnknown = { ...value, unknownCriticalField: true };
      expect(
        runtime.safeParse(withUnknown).success,
        `runtime accepted unknown ${id}`,
      ).toBe(false);
      expect(
        ajv.getSchema(id)?.(withUnknown),
        `published schema accepted unknown ${id}`,
      ).toBe(false);
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

  it("publishes the Checkpoint <-> Cloudflare Workers runtime deployment binding contract", () => {
    const validate = catalogValidator().getSchema(auditId("deployment-binding"));
    const binding = {
      schema: auditId("deployment-binding"),
      config: {
        enabled: true,
        requestedProfile: "AAP-2",
        delivery: "buffered",
        evidenceMode: "encrypted-separate",
        retentionClass: "integrity-ledger",
        retentionDays: 365,
        residency: "inherit-project",
        keyCustody: "checkpoint-managed",
        recorderTopology: "managed",
      },
      readiness: {
        requestedProfile: "AAP-2",
        effectiveProfile: "AAP-2",
        status: "ready",
        reasonCodes: [],
        canary: {
          passed: true,
          observedAt: 1_750_000_000_000,
          capabilities: {
            recorderTopology: "managed",
            delivery: "buffered",
            journalDurability: "durable",
            atomicAppend: true,
            sourceHighWater: true,
            merkleCheckpoints: false,
            independentObservation: false,
            supportingAnchors: [],
            evidenceRetention: "separate",
          },
          checks: [{ id: "recorder_round_trip", passed: true }],
        },
      },
      protocolBinding: "urn:kya-os:audit-binding:mcp:2025-11-25",
      tenantRef: { kind: "pairwise_did", did: "did:key:zTenant" },
      producerRef: { kind: "public_did", did: "did:key:zProducer" },
      recorderSigner: { did: "did:key:zRecorder", kid: "did:key:zRecorder#key-1", alg: "EdDSA" },
      recorderPublicJwk: { kty: "OKP", crv: "Ed25519", x: "base64url-x" },
      secretReferences: {
        producerInternalToken: "KYA_OS_AUDIT_PRODUCER_INTERNAL_TOKEN",
        referenceSecret: "KYA_OS_AUDIT_REFERENCE_SECRET",
      },
    };

    expect(validate).toBeTypeOf("function");
    expect(validate?.(binding)).toBe(true);
    expect(
      validate?.({ ...binding, tenantRef: { kind: "public_did", did: "did:key:zTenant" } }),
      "tenantRef must stay pairwise_did, not any PartyRef kind",
    ).toBe(false);
    expect(
      validate?.({ ...binding, readiness: { ...binding.readiness, canary: null } }),
      "a null canary must still validate",
    ).toBe(true);
    expect(
      validate?.({ ...binding, protocolBinding: "urn:other:binding:1" }),
      "protocolBinding must be a kya-os audit-binding URN",
    ).toBe(false);
    const { secretReferences, ...withoutSecretReferences } = binding;
    expect(
      validate?.(withoutSecretReferences),
      "secretReferences is required",
    ).toBe(false);
    expect(
      validate?.({ ...binding, unknownCriticalField: true }),
      "additional top-level properties must be rejected",
    ).toBe(false);
  });
});
