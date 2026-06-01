# KYA-OS JSON Schemas

This directory is the published, versioned JSON Schema tree for the core KYA-OS
protocol messages. Each document is draft 2020-12 and is served at its `$id` so
that `$ref` resolution and external validators work against a stable URL.

## Schemas

| Schema | `$id` path | Description |
|--------|-----------|-------------|
| `delegation/credential/v1.0.0.json` | `…/v1/protocol/delegation/credential/v1.0.0` | W3C Verifiable Credential for delegations |
| `proof/detached/v1.0.0.json` | `…/v1/protocol/proof/detached/v1.0.0` | Cryptographic proof for a tool request/response |
| `handshake/request/v1.0.0.json` | `…/v1/protocol/handshake/request/v1.0.0` | Client-initiated session establishment request |
| `handshake/response/v1.0.0.json` | `…/v1/protocol/handshake/response/v1.0.0` | Server response with session context |
| `well-known/v1.0.0.json` | `…/v1/protocol/well-known/v1.0.0` | Service discovery document |

## Versioning

A released document at a published `$id` is immutable. A change that alters a
document's meaning is published under a new version path; the prior version
remains served at its existing `$id`.

## Generation

These documents are generated from the schema source of truth in
`packages/protocol-core` and verified byte-for-byte by the drift gate. Do not
hand-edit a published document — change the source and regenerate.

## Validation (Node.js, Ajv)

```javascript
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import schema from "./v1/protocol/proof/detached/v1.0.0.json" with { type: "json" };

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
```
