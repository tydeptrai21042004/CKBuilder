# Test status

## Verified in this packaging environment

Command:

```bash
npm test
```

Result:

- 61 JavaScript test cases discovered;
- 60 passed;
- 0 failed;
- 1 skipped because `@ckb-ccc/core` was not installed.

The passing set covers:

- credential signing, tampering, issuer trust, document integrity and revocation;
- invalid-date rollback and revocation-event binding;
- public inspector outcomes and privacy boundary;
- 75-byte binary codec and canonical-state validation;
- standalone decoder parity across six deterministic vectors;
- exported-proof digest and privacy verification;
- HTTP security headers, request IDs, content type, size limits and path traversal;
- decoder and proof HTTP endpoints;
- OffCKB deployment/system-script parsing without CCC.

Also verified:

```bash
npm run test:vectors
npm run syntax:check
bash scripts/audit-release.sh
```

## Requires installed CCC dependency

```bash
npm ci --no-audit --no-fund
npm test
```

This enables the CCC integration test that derives the known first OffCKB development account Lock Script hash.

## Requires Rust and CKB toolchain

The source contains:

- 5 Rust contract unit tests;
- 18 `ckb-testtool` integration tests.

Run:

```bash
npm run test:rust
```

The new Rust cases include invalid version/status/issuer, foreign output locks, multiple group inputs, and immutable issuer changes. They were added and syntax-reviewed but could not be compiled in the packaging environment because Cargo and the required CKB RISC-V toolchain were unavailable.

## Previous verified local lifecycle

The repository retains the sanitized 14 July 2026 evidence for the earlier contract binary and local OffCKB `ACTIVE → REVOKED` lifecycle. Because the Rust contract has now been hardened, a fresh local lifecycle must be run before claiming that the **new** binary was deployed successfully.
