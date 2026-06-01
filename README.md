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

## Contributing

Contributions require a Developer Certificate of Origin sign-off on every
commit (`git commit -s`). See [CONTRIBUTING.md](./CONTRIBUTING.md),
[GOVERNANCE.md](./GOVERNANCE.md), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## License

[MIT](./LICENSE) — Copyright (c) 2026 KYA-OS.
