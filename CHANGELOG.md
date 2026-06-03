# Changelog

All notable changes to the KYA-OS schema artifacts are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
- Four additional canonical protocol documents under `schemas/v1/protocol/`:
  the StatusList2021 revocation credential (`delegation/status-list`), the
  versioned audit record (`audit/record`), the signed needs-authorization error
  (`authorization/needs-authorization`), and the delegation JSON-LD `@context`
  document (`delegation/context`) — the last resolving the previously dangling
  credential context reference. Authored from the protocol spec and the shipped
  type model; `$id`s on the canonical `schema.kya-os.org` host.
