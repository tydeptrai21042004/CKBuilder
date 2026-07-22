# Test and execution status

## Latest verified automatic run

A complete run was executed in WSL on **22 July 2026** with:

```bash
bash run-full-project.sh
```

### JavaScript

```text
74 tests
74 passed
0 failed
0 skipped
```

The suite covers:

- credential signing, issuer trust, document integrity, revocation, and tamper detection;
- invalid-date rollback and revocation-event binding;
- public inspector outcomes and privacy boundaries;
- 75-byte Cell encoding, decoding, and canonical-state validation;
- deterministic community-vector parity;
- exported-proof digest and privacy verification;
- HTTP security headers, content types, upload limits, path traversal, Cell decoding, and proof verification;
- OffCKB system-script and deployment parsing;
- automatic launcher environment reuse, local account selection, PID safety, one-credential integration, and loopback-only RPC enforcement;
- inspector readiness checking for valid JSON regardless of formatting whitespace.

### Rust contract

```text
5 unit tests passed
18 ckb-testtool integration tests passed
0 failed
```

The contract cases include:

- valid creation and revocation;
- invalid version, status, and data length;
- unauthorized creation;
- foreign output Lock Script rejection;
- credential and issuer immutability;
- missing reason code or timestamp;
- record destruction;
- multiple protected inputs or outputs;
- `REVOKED → ACTIVE` reactivation rejection.

### Local OffCKB lifecycle

- contract deployment: passed;
- `ACTIVE` Cell creation: passed;
- `ACTIVE → REVOKED` transition: passed;
- final indexer result: `activeCount = 0`, `revokedCount = 1`, `invalidCount = 0`;
- read-only inspector startup: passed;
- integrated public proof export and independent verification: passed.

## Evidence

- [`reports/week-02-report.md`](reports/week-02-report.md)
- [`evidence/week-02-run-summary.json`](evidence/week-02-run-summary.json)
- [`evidence/automatic-end-to-end-run-2026-07-22-sanitized.log`](evidence/automatic-end-to-end-run-2026-07-22-sanitized.log)
- [`data/offckb-chain-state.json`](data/offckb-chain-state.json)
- [`data/automatic-public-verification-proof.json`](data/automatic-public-verification-proof.json)
- [`screenshots/04-automatic-end-to-end-success.png`](screenshots/04-automatic-end-to-end-success.png)
- [`screenshots/05-local-offckb-lifecycle-success.png`](screenshots/05-local-offckb-lifecycle-success.png)
- [`screenshots/06-final-revoked-cell.png`](screenshots/06-final-revoked-cell.png)

## Re-run commands

```bash
# Complete environment, test, build, deployment, lifecycle, proof, and inspector run
bash run-full-project.sh

# Reuse the existing local setup
bash run-full-project.sh --fast

# JavaScript tests
npm test

# Community vectors
npm run test:vectors

# Rust tests
npm run test:rust

# Local release checks
npm run ci:local
```

All recorded blockchain transactions are from an ephemeral local OffCKB devnet.
