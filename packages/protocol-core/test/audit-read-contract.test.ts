import { describe, expect, it } from "vitest";
import {
  auditConsistencyProofRequestSchema,
  auditConsistencyProofResponseSchema,
  auditHeadRequestSchema,
  auditHeadResponseSchema,
  auditInclusionProofRequestSchema,
  auditInclusionProofResponseSchema,
  auditListEntriesRequestSchema,
  auditListEntriesResponseSchema,
} from "@kya-os/mcp/audit";
import {
  auditId,
  catalogValidator,
  digest,
  envelopeFixture,
} from "./support/audit-catalog.js";

/**
 * SPEC-AUDIT-READ names eight envelope $ids that @kya-os/mcp validates at
 * runtime but never shipped as JSON Schema. For each published envelope, the
 * schema and the runtime validator must agree on a valid value, on that value
 * with an unknown field, and on every boundary the runtime enforces.
 */
/** The runtime validator's contract, without a direct dependency on zod. */
interface RuntimeSchema {
  safeParse(value: unknown): { success: boolean };
}

interface Case {
  name: string;
  runtime: RuntimeSchema;
  valid: Record<string, unknown>;
  /** Values the runtime rejects; the published schema must reject them too. */
  invalid: Record<string, unknown>[];
}

function cases(): Case[] {
  const { entry } = envelopeFixture();
  const ledger = { ledgerId: "ledger-1", ledgerEpochId: "epoch-1" };
  const head = { ...ledger, sequence: "4", entryDigest: digest("a") };
  const inclusion = {
    ...ledger,
    sequence: "2",
    entryDigest: digest("b"),
    checkpointDigest: digest("c"),
    proof: { leafIndex: "2", treeSize: "5", auditPath: [digest("d")] },
  };
  const consistency = {
    ...ledger,
    oldCheckpointDigest: digest("1"),
    newCheckpointDigest: digest("2"),
    proof: { oldTreeSize: "3", newTreeSize: "5", auditPath: [digest("3")] },
  };
  const envelope = (name: string, body: Record<string, unknown>) => ({
    schema: auditId(name),
    ...body,
  });
  const { checkpointDigest: _dropped, ...inclusionWithoutCheckpoint } =
    inclusion;

  return [
    {
      name: "head-request",
      runtime: auditHeadRequestSchema,
      valid: envelope("head-request", { ledger }),
      invalid: [
        envelope("head-request", { ledger: { ...ledger, ledgerId: "" } }),
        envelope("head-request", { ledger: { ...ledger, extra: 1 } }),
      ],
    },
    {
      name: "head-response",
      runtime: auditHeadResponseSchema,
      valid: envelope("head-response", { head }),
      invalid: [
        envelope("head-response", { head: { ...head, sequence: "01" } }),
        envelope("head-response", {
          head: { ...head, entryDigest: "sha256:nothex" },
        }),
      ],
    },
    {
      name: "list-entries-request",
      runtime: auditListEntriesRequestSchema,
      valid: envelope("list-entries-request", {
        ledger,
        afterSequence: "10",
        limit: 1000,
      }),
      invalid: [
        envelope("list-entries-request", { ledger, limit: 1001 }),
        envelope("list-entries-request", { ledger, limit: 0 }),
        envelope("list-entries-request", { ledger, limit: 2.5 }),
        envelope("list-entries-request", {
          ledger,
          afterSequence: "1".repeat(21),
        }),
      ],
    },
    {
      name: "list-entries-response",
      runtime: auditListEntriesResponseSchema,
      valid: envelope("list-entries-response", {
        entries: [entry],
        head,
        nextAfterSequence: "0",
      }),
      invalid: [
        envelope("list-entries-response", {
          entries: [{}],
          head,
          nextAfterSequence: null,
        }),
        envelope("list-entries-response", { entries: [], head }),
      ],
    },
    {
      name: "inclusion-proof-request",
      runtime: auditInclusionProofRequestSchema,
      valid: envelope("inclusion-proof-request", { ledger, sequence: "2" }),
      invalid: [
        envelope("inclusion-proof-request", { ledger, sequence: "-1" }),
      ],
    },
    {
      name: "inclusion-proof-response",
      runtime: auditInclusionProofResponseSchema,
      valid: envelope("inclusion-proof-response", { proof: inclusion }),
      invalid: [
        envelope("inclusion-proof-response", {
          proof: inclusionWithoutCheckpoint,
        }),
      ],
    },
    {
      name: "consistency-proof-request",
      runtime: auditConsistencyProofRequestSchema,
      valid: envelope("consistency-proof-request", {
        ledger,
        oldTreeSize: "3",
      }),
      invalid: [envelope("consistency-proof-request", { ledger })],
    },
    {
      name: "consistency-proof-response",
      runtime: auditConsistencyProofResponseSchema,
      valid: envelope("consistency-proof-response", { proof: consistency }),
      invalid: [
        envelope("consistency-proof-response", {
          proof: { ...consistency, proof: {} },
        }),
      ],
    },
  ];
}

describe("audit read-contract envelopes (SPEC-AUDIT-READ)", () => {
  const ajv = catalogValidator();
  const validator = (name: string) => {
    const validate = ajv.getSchema(auditId(name));
    expect(validate, `no published schema for ${name}`).toBeTypeOf("function");
    return validate!;
  };

  it("agrees with the runtime on a valid envelope and on an unknown field", () => {
    for (const { name, runtime, valid } of cases()) {
      const validate = validator(name);
      expect(runtime.safeParse(valid).success, `runtime rejected ${name}`).toBe(
        true,
      );
      expect(
        validate(valid),
        `published schema rejected ${name}: ${JSON.stringify(validate.errors)}`,
      ).toBe(true);
      const withUnknown = { ...valid, unknownCriticalField: true };
      expect(runtime.safeParse(withUnknown).success).toBe(false);
      expect(validate(withUnknown), `accepted unknown field on ${name}`).toBe(
        false,
      );
    }
  });

  it("rejects what the runtime rejects at each boundary it enforces", () => {
    for (const { name, runtime, invalid } of cases()) {
      const validate = validator(name);
      for (const value of invalid) {
        const shown = JSON.stringify(value);
        expect(
          runtime.safeParse(value).success,
          `runtime accepted ${shown}`,
        ).toBe(false);
        expect(validate(value), `${name} accepted ${shown}`).toBe(false);
      }
    }
  });

  it("accepts an empty ledger: a null head and no continuation", () => {
    const empty = {
      schema: auditId("list-entries-response"),
      entries: [],
      head: null,
      nextAfterSequence: null,
    };
    expect(auditListEntriesResponseSchema.safeParse(empty).success).toBe(true);
    expect(validator("list-entries-response")(empty)).toBe(true);
    const noHead = { schema: auditId("head-response"), head: null };
    expect(auditHeadResponseSchema.safeParse(noHead).success).toBe(true);
    expect(validator("head-response")(noHead)).toBe(true);
  });

  it("pins each envelope to its own $id, so one cannot pass as another", () => {
    const [request] = cases();
    const relabelled = { ...request.valid, schema: auditId("head-response") };
    expect(request.runtime.safeParse(relabelled).success).toBe(false);
    expect(validator(request.name)(relabelled)).toBe(false);
  });
});
