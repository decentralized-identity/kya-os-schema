# Changelog

All notable changes to the KYA-OS schema artifacts are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **Donation pin `@kya-os/mcp` 1.14.0 → 1.16.2.** `schema.kya-os.org` now
  serves what the reference implementation ships:
  - `delegation/credential/v1.0.0`: `credentialStatus` accepts a
    `BitstringStatusListEntry` (the W3C StatusList2021 successor) with `id`
    optional, and the CRISP scope matcher accepts `path-prefix`. Consumers
    have minted Bitstring entries since `@kya-os/id` 0.2.0; until this change
    a validator loading the published schema rejected them.
  - `well-known/v1.0.0`: `version` accepts a three-part protocol version and
    `endpoints.handshake` is optional (the stateless profile has none).
  - `proof/detached/v1.1.0` is new: the additive `prf` discriminator for
    envelope-profile response proofs. `v1.0.0` is unchanged and still served.
- **In-place changes are an audited ledger, not code.** The one-entry-per-path
  migration map in `emit-schemas.mjs` could not record a second change to the
  same schema. `packages/protocol-core/in-place-transitions.json` lists every
  compatible widening applied at an existing `$id` as an exact
  SHA-256 → SHA-256 transition with its upstream release and reason; the emit
  step refuses anything not listed, and a test checks each path's entries
  chain in order and end at the published bytes.
- The donation pin is declared once, as the exact `@kya-os/mcp`
  devDependency; the emit script and the publication test read it from
  there instead of repeating it.

### Added

- Complete audit schema publication from `@kya-os/mcp` v1.11.0, including
  producer events, recorder entry/receipt cores, checkpoints, observations,
  supporting anchors, Merkle proofs, verification policy/report, and signed
  replay-bundle inventory.
- Registry-owned external envelope schemas for signed receipts, entries,
  checkpoints, manifests, replay components, ledger-bound proofs, and the full
  replay bundle, with runtime acceptance parity tests.
- Cloudflare Pages route smoke checks and RFC 9457-style JSON 404 responses;
  CI and deployment now exercise the same build and route contract.
- Enriched `schema-index.json` discovery metadata and a public retrieval alias
  for the relative audit-event reference frozen into the v1.11.0 entry schema.

### Changed

- `well-known/v1.0.0` now includes the audit capability object shipped by
  `@kya-os/mcp` v1.11.0. This is a digest-pinned one-time synchronization of an
  existing `$id`; future semantic changes remain required to use a new version.

- Repository scaffold and DIF donation governance (LICENSE, DCO, GOVERNANCE,
  CONTRIBUTING, SECURITY, CONFORMANCE, CODE_OF_CONDUCT).
- Commit hooks enforcing DCO sign-off and rejecting tooling attribution, with a
  behavioral test suite.
- The five core protocol schemas published as the source of truth under
  `schemas/v1/protocol/` (delegation credential, detached proof, handshake
  request and response, discovery document), each draft 2020-12 with a canonical
  `$id`.
- `@kya-os/schema` package with a parameterized schema base URL and a test
  suite asserting draft, `$id`, title, validator compilation, and naming.
- Cloudflare Pages publishing pipeline: a `build:pages` step emitting a `dist/`
  artifact that serves each schema at both its extensionless `$id` and `.json`
  path (with `application/schema+json`, open CORS, and caching) plus a
  `schema-index.json`, and a `Deploy schemas` workflow that uploads it to
  `schema.kya-os.org`.
- Donation-sync drift gate (`pnpm run drift`) verifying the published schemas
  stay byte-identical to the schemas shipped by the donated `@kya-os/mcp`
  package, with tests proving the gate bites on divergence.
- Continuous integration: a test/drift job and a hygiene job rejecting retired
  protocol naming and tooling attribution in content and commit history.
