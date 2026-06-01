# Conformance

This document defines what it means to conform to the KYA-OS schema artifacts
published in this repository. Conformance is layered; each level builds on the
one below it.

## Level 1 — Schema Validity

A published schema document is **Level 1 conformant** when:

- It is a valid JSON Schema under the **draft 2020-12** meta-schema.
- Its `$id` resolves to the document served at the corresponding published path.
- All internal `$ref`s resolve within the versioned tree.

## Level 2 — Source-of-Truth Alignment

A schema document is **Level 2 conformant** when, in addition to Level 1:

- It is byte-identical to the output of the `protocol-core` generator for its
  version (no hand-editing has diverged the published document from the source).
- The schemas vendored into a downstream KYA-OS binding are byte-identical to the
  documents published here (verified by the drift gate).

## Level 3 — Registry Entry Conformance

A compatibility registry entry is **Level 3 conformant** when:

- It validates against the registry submission schema
  (`registry/schema/provider.schema.json` or `implementation.schema.json`).
- Its declared capabilities are members of the published capability vocabulary.
- Where an attestation is supplied, the attestation verifies against the entry's
  declared DID.

## Verification

All three levels are checked by CI:

- Level 1 / Level 2 — the drift gate (`pnpm run drift`).
- Level 3 — the registry validator (`registry/cli.js validate`).

An implementation claiming KYA-OS compatibility SHOULD reference the published
schema `$id`s it validates against and MAY submit a registry entry recording its
conformance.
