# Security Policy

## Reporting a Vulnerability

Do not open public GitHub issues for security vulnerabilities.

Report privately to **dylan.hobbs@vouched.id**. You will receive:

- An acknowledgement within **48 hours**.
- A triage assessment within **7 days**.
- Coordinated disclosure within **90 days**, or sooner once a fix is published.

## Scope

This repository publishes machine-readable protocol artifacts. Security-relevant
concerns include:

- **Malformed-schema injection** — a schema document that, when consumed by a
  validator, causes denial of service or unsafe behavior.
- **`$id` / `$ref` integrity** — a change that causes a published `$id` to
  resolve to unintended content, or a `$ref` to dereference outside the
  versioned tree.
- **Registry supply chain** — a pull-requested registry entry that misrepresents
  an implementation's identity, claims compatibility it does not have, or carries
  a forged attestation.
- **Schema drift** — a published schema diverging from the protocol-core source
  of truth or from a downstream binding in a way that weakens a security
  guarantee.

Out of scope: vulnerabilities in third-party validators, hosting infrastructure,
or downstream implementations that are not produced in this repository.

## Supported Versions

The most recent published schema version line receives security fixes. Released
documents are immutable at their `$id`; a security correction that changes a
document's meaning is published under a new version path.
