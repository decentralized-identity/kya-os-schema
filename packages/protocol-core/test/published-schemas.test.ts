import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const here = dirname(fileURLToPath(import.meta.url));
// repo root is three levels up from packages/protocol-core/test
const schemasDir = join(here, "..", "..", "..", "schemas", "v1", "protocol");

/**
 * The published protocol schemas, with the canonical `$id` each one must carry.
 * The host segment is asserted against the parameterized base URL default so a
 * host migration is caught here rather than shipping a dangling `$id`.
 */
const EXPECTED = [
  {
    file: "delegation/credential/v1.0.0.json",
    id: "https://schema.kya-os.ai/v1/protocol/delegation/credential/v1.0.0",
    title: "KYA-OS Delegation Credential",
  },
  {
    file: "proof/detached/v1.0.0.json",
    id: "https://schema.kya-os.ai/v1/protocol/proof/detached/v1.0.0",
    title: "KYA-OS Detached Proof",
  },
  {
    file: "handshake/request/v1.0.0.json",
    id: "https://schema.kya-os.ai/v1/protocol/handshake/request/v1.0.0",
    title: "KYA-OS Handshake Request",
  },
  {
    file: "handshake/response/v1.0.0.json",
    id: "https://schema.kya-os.ai/v1/protocol/handshake/response/v1.0.0",
    title: "KYA-OS Handshake Response",
  },
  {
    file: "well-known/v1.0.0.json",
    id: "https://schema.kya-os.ai/v1/protocol/well-known/v1.0.0",
    title: "KYA-OS Discovery Document",
  },
  {
    file: "delegation/status-list/v1.0.0.json",
    id: "https://schema.kya-os.org/v1/protocol/delegation/status-list/v1.0.0",
    title: "KYA-OS StatusList2021 Credential",
  },
  {
    file: "audit/record/v1.0.0.json",
    id: "https://schema.kya-os.org/v1/protocol/audit/record/v1.0.0",
    title: "KYA-OS Audit Record",
  },
  {
    file: "authorization/needs-authorization/v1.0.0.json",
    id: "https://schema.kya-os.org/v1/protocol/authorization/needs-authorization/v1.0.0",
    title: "KYA-OS Needs-Authorization Error",
  },
];

function loadSchema(rel: string): Record<string, unknown> {
  const path = join(schemasDir, rel);
  expect(existsSync(path), `schema file is missing: ${rel}`).toBe(true);
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("published protocol schemas", () => {
  it.each(EXPECTED)("$file declares draft 2020-12", ({ file }) => {
    const schema = loadSchema(file);
    expect(schema.$schema).toBe("https://json-schema.org/draft/2020-12/schema");
  });

  it.each(EXPECTED)("$file carries its canonical $id and title", ({ file, id, title }) => {
    const schema = loadSchema(file);
    expect(schema.$id).toBe(id);
    expect(schema.title).toBe(title);
  });

  it.each(EXPECTED)("$file compiles under the 2020-12 validator", ({ file }) => {
    const schema = loadSchema(file);
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    // Compiling proves the schema is well-formed and all internal $refs resolve.
    expect(() => ajv.compile(schema)).not.toThrow();
  });

  it("carries no retired protocol naming in any published schema", () => {
    for (const { file } of EXPECTED) {
      const raw = readFileSync(join(schemasDir, file), "utf8");
      expect(raw, `${file} contains retired naming`).not.toMatch(/mcp[-_ ]?i\b/i);
    }
  });
});
