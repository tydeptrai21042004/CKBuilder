# Changelog

## 2.1.1 — Automatic end-to-end launcher

### Added

- Root `run-full-project.sh` launcher for environment detection, installation, local account selection, full build/test/deploy/lifecycle, and inspector startup.
- `--fast`, `--status`, `--restart`, `--stop`, `--foreground`, and `--no-install` modes.
- Persistent project-owned PID files and safe service shutdown that does not terminate an external OffCKB node.
- Machine-readable `data/run/launch-summary.json` after a successful run.
- Integrated public-proof export using the same credential ID across the off-chain and on-chain lifecycle.
- Automatic-launcher tests and complete setup documentation.

### Changed

- The local OffCKB runner can keep its node alive through `nohup` and records its managed PID.
- Existing compatible Node, npm, Rust, toolchain, dependency, key, configuration, RPC, and service state is reused where possible.
- The documented primary run command no longer requires manual wallet or account setup.
- `.env` files are parsed as data rather than executed as shell code.
- The launcher forces a loopback-only RPC and refuses non-local endpoints.

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

## 2.1.2 - 2026-07-22

### Fixed

- Fixed a false-negative inspector startup failure in the one-command launcher.
- The health checker now accepts both compact JSON (`"ok":true`) and pretty-printed JSON (`"ok": true`).
- Added a reusable health-response parser and a regression test for the exact response format returned by `/api/health`.
- Startup failures now print the direct health response and inspector log for diagnosis.

### Documentation and evidence update

- Added professional Week 1 and Week 2 reports with direct evidence links.
- Added three Week 2 screenshots for the successful automatic run, lifecycle completion, and final `REVOKED` Cell.
- Added a sanitized complete end-to-end terminal log and machine-readable Week 2 run summary.
- Updated README, test status, handbook tracker, requirements matrix, and submission checklist to the latest verified results.
- Removed generated `.env`, issuer private keys, OffCKB private-account listings, and stale PID files from the distributable package.
