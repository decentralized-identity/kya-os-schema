# KYA-OS Schema

The single source of truth for the KYA-OS protocol's machine-readable
artifacts: the normative JSON Schemas, the specification site, and the
compatibility registry.

This repository holds:

- **`packages/protocol-core/`** — the canonical schema definitions and the
  generator that emits versioned JSON Schema (draft 2020-12) documents.
- **`schemas/`** — the published, versioned JSON Schema tree. Each document is
  served at its `$id` (for example `…/v1/protocol/proof/detached/v1.0.0`) so
  that `$ref` resolution and external validators work against a stable URL.
- **`site/`** — the specification site: normative prose, the protocol
  primitives, and the transport bindings.
- **`registry/`** — the compatibility registry. Identity providers and
  implementations submit a declarative entry by pull request; a merged entry is
  published in the registry index and listed as KYA-OS compatible.

## Schema URLs

Schema `$id`s are templated from a single base URL so the publishing host can
move without per-document churn. The base URL defaults to the current host and
is overridable by environment for the production host.

## Publishing

The versioned schema tree is published to **Cloudflare Pages** at
`https://schema.kya-os.org`. On every push to `main` that touches `schemas/`,
the [`Deploy schemas`](./.github/workflows/deploy-schemas.yml) workflow builds
the deploy artifact (`pnpm run build:pages` → `dist/`) and uploads it.

Each schema is served at both its canonical extensionless `$id`
(`…/v1/protocol/proof/detached/v1.0.0`) and the `.json` path, with
`Content-Type: application/schema+json`, open CORS, and a cache policy. A
`schema-index.json` lists every published `$id`.

**One-time setup (DIF Cloudflare account):** create a Pages project named
`kya-os-schema`, bind `schema.kya-os.org` as its custom domain, and add the
repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Contributing

Contributions require a Developer Certificate of Origin sign-off on every
commit (`git commit -s`). See [CONTRIBUTING.md](./CONTRIBUTING.md),
[GOVERNANCE.md](./GOVERNANCE.md), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) — Copyright (c) 2026 KYA-OS.
