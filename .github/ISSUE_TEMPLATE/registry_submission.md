---
name: Registry submission
about: List an identity provider or implementation as KYA-OS compatible
title: "registry: <name>"
labels: registry
---

<!-- Most submissions should be a pull request adding a single JSON entry under
     registry/providers/ or registry/implementations/. Open this issue first
     only if you need to discuss the submission before opening the PR. -->

## Entry kind

- [ ] Provider (identity / auth provider)
- [ ] Implementation (claims alignment with the KYA-OS schemas)

## Identity

- Name:
- DID:
- Declared capabilities (from the published capability vocabulary):

## Endpoints

- `.well-known` path:
- Handshake / verification endpoints (if applicable):

## Attestation

<!-- Optional: a JWS over the entry, signed by the declared DID, lets the
     listing be cryptographically verified rather than self-asserted. -->
