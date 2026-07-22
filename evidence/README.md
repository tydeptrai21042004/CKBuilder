# Verified Local Execution Evidence

This directory contains sanitized evidence for the CKBuilder capstone. All blockchain transactions belong to ephemeral local OffCKB devnets and are not public testnet or mainnet transactions.

## Week 2 — 22 July 2026

The latest report uses the following evidence:

- [`week-02-run-summary.json`](week-02-run-summary.json) — machine-readable summary of the final v2.1.2 run;
- [`automatic-end-to-end-run-2026-07-22-sanitized.log`](automatic-end-to-end-run-2026-07-22-sanitized.log) — complete sanitized terminal transcript from a successful automatic run on the same date;
- [`../data/offckb-chain-state.json`](../data/offckb-chain-state.json) — latest `ACTIVE → REVOKED` lifecycle result;
- [`../data/automatic-public-verification-proof.json`](../data/automatic-public-verification-proof.json) — read-only public proof;
- [`../data/run/launch-summary.json`](../data/run/launch-summary.json) — service and artifact locations;
- [`../deployment/scripts.json`](../deployment/scripts.json) — latest local contract deployment metadata;
- [`../screenshots/04-automatic-end-to-end-success.png`](../screenshots/04-automatic-end-to-end-success.png) — inspector and proof success;
- [`../screenshots/05-local-offckb-lifecycle-success.png`](../screenshots/05-local-offckb-lifecycle-success.png) — local lifecycle completion;
- [`../screenshots/06-final-revoked-cell.png`](../screenshots/06-final-revoked-cell.png) — final canonical `REVOKED` Cell.

### Latest verified result

- Node.js tests: **74 passed, 0 failed**;
- Rust contract unit tests: **5 passed, 0 failed**;
- CKB integration tests: **18 passed, 0 failed**;
- contract deployed successfully to local OffCKB;
- one credential ID was used for the off-chain and on-chain workflow;
- an `ACTIVE` registry Cell was created and consumed;
- one canonical `REVOKED` Cell remained;
- the inspector started without loading an issuer private key;
- the public proof was exported and independently verified.

The full transcript records an earlier successful automatic run on 22 July. The latest screenshot and machine-readable artifacts record the subsequent v2.1.2 run. They are intentionally identified separately rather than presented as one execution.

## Week 1 — 14 July 2026

Historical evidence from the first capstone version remains available:

- [`run-summary.json`](run-summary.json);
- [`local-offckb-run-sanitized.log`](local-offckb-run-sanitized.log);
- [`../screenshots/01-rust-contract-tests.png`](../screenshots/01-rust-contract-tests.png);
- [`../screenshots/02-contract-deployment.png`](../screenshots/02-contract-deployment.png);
- [`../screenshots/03-local-offckb-success.png`](../screenshots/03-local-offckb-success.png).

## Inspector and community-package development evidence

- `v2-node-tests.txt`;
- `v2-offline-inspector.txt`;
- `v2-inspector-smoke-summary.json`;
- `v2.1-node-tests.txt`;
- `v2.1-community-conformance.txt`;
- `v2.1-http-smoke-summary.json`;
- `v2.1-proof-verifier.txt`;
- `v2.1-ci-local.txt`;
- `v2.1.1-automatic-launcher-node-tests.txt`;
- `v2.1.1-automatic-launcher-shell-checks.txt`;
- `v2.1.2-inspector-health-fix.txt`.

## Privacy treatment

- local usernames and absolute project paths were removed from the full terminal transcript;
- generated issuer private keys and `.env` are not included;
- the OffCKB account listing containing development private keys is not included;
- local-devnet addresses, hashes, and transaction identifiers are retained because they are technical evidence rather than production secrets.
