# Changelog

## 2.1.0 — Community interoperability and policy hardening

### Added

- Dependency-free credential Cell-data decoder under `community/decoder/`.
- Deterministic valid and malformed cross-implementation test vectors.
- Written `ckb-degree-credential-cell/v1` binary specification.
- Cell-data decoder CLI and HTTP endpoint.
- Independent public-proof digest/privacy verifier CLI and HTTP endpoint.
- Hardened, testable HTTP server module with security headers, request IDs, content-type checks, path-traversal protection, and upload limits.
- Community contribution guide, issue templates, pull-request template, licence, and conduct guidance.
- Handbook progress matrix and evidence-first weekly-report/learning templates.
- Expanded Node.js tests for codec, proof integrity, HTTP security, configuration parsing, and conformance vectors.
- Additional Rust unit and integration test cases.

### Changed

- Type Script now requires protected input/output registry Cells to use the issuer Lock Script hash stored in Type Script args.
- Immutable issuer/version changes during update receive an explicit immutable-field failure.
- Record JSON now includes status names, reason names, canonical validation state, and ISO revocation time where representable.
- OffCKB system/deployment parsing is isolated from CCC so pure configuration tests run without network dependencies.

### Known limitation

- Global credential-hash uniqueness across independently created Cell lineages remains unenforced by the Type Script. Clients prevent ordinary duplicate creation and the inspector reports duplicate live records as conflicts.

## 2.0.0 — Public Credential Inspector

- Added no-private-key public credential inspection.
- Added off-chain/on-chain state comparison and proof export.
- Added browser interface and duplicate/malformed Cell reporting.
- Fixed revocation timestamp rollback and signed-event binding defects.
