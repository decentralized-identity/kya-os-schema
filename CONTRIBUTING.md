# Contributing to KYA-OS Schema

Thank you for your interest in contributing. This repository is the source of
truth for the KYA-OS (Know Your Agent Operating System) protocol's JSON Schemas,
specification site, and compatibility registry, developed in the
[DIF Trust and Authorization for AI Agents Working Group (TAAWG)](https://identity.foundation/working-groups/agent-and-authorization.html).

Contributions are welcome: schema clarifications, spec prose, registry entries,
tooling, and test improvements.

---

## DIF Membership

Contributing to this repository requires [**DIF Membership**](https://identity.foundation/join).
DIF is the standards body where the KYA-OS protocol is developed and ratified;
membership is the licensing and IPR vehicle that lets contributions land in a
DIF-owned specification without ambiguity. Please join before opening a pull
request.

---

## Developer Certificate of Origin (DCO)

**Every commit must include a sign-off trailer:**

```
Signed-off-by: Your Name <your@email.com>
```

Add it automatically with:

```bash
git commit -s -m "your commit message"
```

Commits without a DCO sign-off are rejected by the commit hook and will not be
merged.

---

## Commit Messages

This repository uses [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject
```

`type` is one of `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `build`,
`ci`. A breaking change uses `!` (for example `refactor!:`). Write in a neutral,
technical voice that describes the change; do not include tooling attribution or
process notes. The commit hook rejects assistant/tooling attribution trailers.

---

## Branch Naming

| Prefix  | Use                                  |
| ------- | ------------------------------------ |
| feat/   | New schemas or protocol extensions   |
| fix/    | Corrections                          |
| docs/   | Specification or documentation only  |
| test/   | Test additions or improvements       |
| chore/  | Tooling, CI, dependency updates      |

---

## Getting Started

```bash
git clone https://github.com/kya-os/schema.git
cd schema
pnpm install
pnpm test
pnpm run gen      # regenerate schemas from the protocol-core source
pnpm run drift    # verify generated == committed == donated schemas
```

---

## Pull Request Process

1. Fork and create a branch from `main`.
2. Make changes with DCO-signed commits (`git commit -s`).
3. Ensure all tests and the drift gate pass: `pnpm test && pnpm run drift`.
4. Note relevant specification sections if your change affects the protocol.
5. Update `CHANGELOG.md` under `[Unreleased]`.
6. Open a PR against `main` and fill out the PR template.

---

## Schema Changes

A released schema document at a published `$id` is immutable. Corrections that
change a document's meaning are published under a new version path and
coordinated with DIF TAAWG. Open an issue first for any change that affects the
protocol.

---

## Registry Submissions

To list an identity provider or implementation as KYA-OS compatible, add a
single declarative entry under `registry/providers/` or
`registry/implementations/` and open a pull request. The entry is validated
automatically against the registry schema; see `registry/README.md`.

---

## Reporting Security Issues

Do not open public issues for security vulnerabilities. See
[SECURITY.md](./SECURITY.md).

---

## Code of Conduct

This project follows the [Contributor Covenant](./CODE_OF_CONDUCT.md).
