# KYA-OS Schema

The canonical registry of machine-readable artifacts for the
[KYA-OS protocol](https://kya-os.org): every normative JSON Schema, versioned
and immutable, served at a stable `$id` URL.

KYA-OS v1 is a ratified specification of the
[DIF Trusted Agents & Authority Working Group](https://identity.foundation/working-groups/trusted-agents.html).
The specification of record lives in
[`kya-os/kya-os`](https://github.com/kya-os/kya-os); the reference
implementation is [`@kya-os/mcp`](https://github.com/decentralized-identity/kya-os-mcp)
on npm.

## Using the schemas

Every schema is published at its canonical `$id` under
`https://schema.kya-os.org/v1/protocol/`, served with
`Content-Type: application/schema+json` and open CORS, so any JSON Schema
validator can fetch and resolve it from any origin:

```bash
curl https://schema.kya-os.org/v1/protocol/proof/detached/v1.0.0
```

Point a `$ref` or `$schema` field directly at the `$id`:

```json
{ "$ref": "https://schema.kya-os.org/v1/protocol/delegation/credential/v1.0.0" }
```

Each document is served both extensionless (the canonical `$id`) and at the
`.json` path. Machine-readable discovery of every published schema is at
[`/schema-index.json`](https://schema.kya-os.org/schema-index.json); unknown
routes return an RFC 9457 `application/problem+json` 404, never a fallback
page.

**Immutability:** a published schema never changes in place. Breaking changes
are published at a new version path, and superseded versions stay served — pin
a version with confidence.

## Repository layout

- **`schemas/`** — the published, versioned JSON Schema tree, mirrored
  byte-for-byte to the serving host.
- **`packages/protocol-core/`** — the synchronization generator, drift gate,
  and publication tests. Donated schemas are pinned to an exact
  [`@kya-os/mcp`](https://www.npmjs.com/package/@kya-os/mcp) release (see
  `packages/protocol-core/package.json` for the current pin); the drift gate
  fails CI if the published tree and the donated bytes ever diverge. The
  registry also publishes external envelope schemas (signed entries, receipts,
  checkpoints, manifests, replay bundles) that compose the immutable donated
  component schemas and are checked against the package's runtime contracts.

## Publishing pipeline

The schema tree deploys to Cloudflare Pages at `https://schema.kya-os.org`.
CI and the [deploy workflow](./.github/workflows/deploy-schemas.yml) run the
same fail-closed sequence — unit and runtime-parity tests, the donation drift
gate, a production Pages build, and route smoke tests covering both known
schema routes and the unknown-route problem response — before any artifact can
be uploaded. A deploy that would serve wrong bytes fails instead of shipping.

## Contributing

Contributions require a Developer Certificate of Origin sign-off on every
commit (`git commit -s`). See [CONTRIBUTING.md](./CONTRIBUTING.md),
[GOVERNANCE.md](./GOVERNANCE.md), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) — Copyright (c) 2026 KYA-OS.
