# Governance

## Project Role

This repository is the source of truth for the **KYA-OS** (Know Your Agent
Operating System) protocol's machine-readable artifacts: the normative JSON
Schemas, the specification site, and the compatibility registry. The protocol's
schema definitions are generated here and published at stable, versioned URLs;
binding implementations are held to these schemas by conformance.

## Maintainers

| Name        | Email                  | Role               |
| ----------- | ---------------------- | ------------------ |
| Dylan Hobbs | dylan.hobbs@vouched.id | Initial Maintainer |

## Decision Making

### Non-Breaking Changes

Non-breaking changes follow a **lazy consensus** model:

- Proposed via pull request
- Approved after 72 hours with no objections from maintainers
- Any maintainer may merge after the waiting period

### Breaking Changes

Breaking changes to a published schema or its `$id` require **explicit vote**:

- Labeled with `breaking-change`
- Requires approval from a majority of active maintainers
- Minimum 7-day discussion period
- A superseded schema version remains served at its existing `$id`; breaking
  changes are published under a new version path, never by mutating a released
  document.
- Schema changes are coordinated with DIF TAAWG.

### Registry Submissions

Compatibility registry entries (`registry/`) are reviewed by the registry
maintainers:

- Provider entries require **two approvals** and a minimum 7-day window.
- Implementation (self-attested alignment) entries require **one approval**.
- All entries must pass automated schema validation before review.

## Relationship to DIF TAAWG

The KYA-OS protocol is donated to the **Decentralized Identity Foundation (DIF)
Trust and Authorization for AI Agents Working Group (TAAWG)** and is under
review there for ratification.

- **Spec decisions** are made in the working group.
- **Schema and publishing decisions** are made here, tracking the authoritative
  spec as it evolves in TAAWG.
- Divergences between a published schema and the spec should be reported as
  issues and resolved with the working group.

## Becoming a Maintainer

1. **Sustained contributions** — ongoing quality pull requests, issue triage,
   and community engagement.
2. **DCO compliance** — all contributions signed off per the Developer
   Certificate of Origin.
3. **Nomination** — nominated by an existing maintainer.
4. **Approval** — approved by majority vote of existing maintainers.

## Code of Conduct

All participants follow the [Contributor Covenant](./CODE_OF_CONDUCT.md).
Harassment, discrimination, and disruptive behavior are not tolerated.

## License

This project is licensed under the MIT License. See [LICENSE](./LICENSE).
