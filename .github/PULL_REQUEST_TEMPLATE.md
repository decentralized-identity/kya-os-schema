<!-- Describe the change in a neutral, technical voice. -->

## Description

<!-- What does this change do and why? -->

## Spec Impact

<!-- Does this change a published schema, a $id, or normative prose?
     If a released schema changes meaning, it must be published under a new
     version path and coordinated with DIF TAAWG. State "none" if not applicable. -->

## Checklist

- [ ] Commits are signed off (`git commit -s`) per the DCO.
- [ ] `pnpm test` passes.
- [ ] `pnpm run drift` passes (generated == committed == donated schemas).
- [ ] Registry submissions validate (`node registry/cli.js validate`), if applicable.
- [ ] `CHANGELOG.md` updated under `[Unreleased]`, if applicable.
