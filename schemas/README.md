# KYA-OS JSON Schemas

This directory is the published, versioned JSON Schema tree for the core KYA-OS
protocol messages. Each document is draft 2020-12 and is served at its `$id` so
that `$ref` resolution and external validators work against a stable URL.

## Schemas

The complete machine-readable catalog is
[`https://schema.kya-os.org/schema-index.json`](https://schema.kya-os.org/schema-index.json).
Core identity, handshake, delegation, authorization, proof, and discovery
schemas share the tree with the audit artifacts below.

### Audit components and envelopes

| Resource | Description |
|---|---|
| `audit/event/v1.0.0` | Strict privacy-minimal producer event |
| `audit/entry/v1.0.0` | Recorder-assigned chained entry core |
| `audit/receipt/v1.0.0` | Recorder append-receipt core |
| `audit/signed-receipt/v1.0.0` | Receipt core and recorder JWS |
| `audit/signed-entry/v1.0.0` | Complete signed entry envelope |
| `audit/checkpoint/v1.0.0` | RFC 9162 checkpoint core |
| `audit/signed-checkpoint/v1.0.0` | Checkpoint core, digest, and issuer JWS |
| `audit/observation/v1.0.0` | Independently signed checkpoint observation |
| `audit/anchor-receipt/v1.0.0` | Supporting WORM, RFC 3161, or SCITT receipt |
| `audit/inclusion-proof/v1.0.0` | RFC 9162 inclusion proof |
| `audit/consistency-proof/v1.0.0` | RFC 9162 consistency proof |
| `audit/bundle-inclusion-proof/v1.0.0` | Ledger-bound bundle inclusion proof |
| `audit/bundle-consistency-proof/v1.0.0` | Ledger-bound bundle consistency proof |
| `audit/bundle-manifest/v1.0.0` | Replay selection and inventory core |
| `audit/signed-bundle-manifest/v1.0.0` | Manifest core, digest, and exporter JWS |
| `audit/bundle-component/v1.0.0` | Included or explicitly omitted inventory component |
| `audit/replay-bundle/v1.0.0` | Complete portable replay bundle |
| `audit/ingest-response/v1.0.0` | Committed recorder acknowledgement and verification outcomes |
| `audit/verification-policy/v1.0.0` | Out-of-band historical trust policy |
| `audit/verification-report/v1.0.0` | Multi-dimensional offline verification result |
| `audit/record/v1.0.0` | Legacy portable audit-record projection |

## Versioning

A released document at a published `$id` is immutable. A new change that alters
a document's meaning must use a new version path; the prior version remains
served at its existing `$id`.

## Generation

`pnpm run gen` resolves the exactly pinned `@kya-os/mcp` v1.11.0 package and
maps each donated `$id` to its public path. Existing bytes must match, except
for a digest-pinned one-time discovery-schema migration recorded in the
generator. The drift gate then verifies every donated schema byte-for-byte.

The signed external envelope and replay-bundle schemas are authored in this
registry because the frozen v1.11.0 package exposes their runtime Zod contracts
but does not ship corresponding JSON Schema files. Runtime parity tests prevent
those publication schemas from silently changing acceptance shape.

## Validation (Node.js, Ajv)

```javascript
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "./v1/protocol/proof/detached/v1.0.0.json" with { type: "json" };

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
```
