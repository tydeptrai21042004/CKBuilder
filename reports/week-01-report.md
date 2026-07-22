# CKBuilder Weekly Report — Week 1

**Reporting period:** 8–14 July 2026  
**Publication date:** 14 July 2026  
**Participant:** Dang Ba Ty  
**Project:** CKB Degree Proof — Credential Revocation on CKB

## Summary

During Week 1, I built and tested the first version of CKB Degree Proof. The project combines a Node.js credential application with a Rust CKB Type Script. The application creates and verifies signed academic credentials, while the on-chain policy enforces an irreversible `ACTIVE → REVOKED` transition for one Cell lineage.

## Learning activities and results

| Activity | Result | Evidence |
|---|---:|---|
| Local CKB development environment with OffCKB | Completed | [`../evidence/local-offckb-run-sanitized.log`](../evidence/local-offckb-run-sanitized.log) |
| Rust CKB contract build | Passed | [`../screenshots/01-rust-contract-tests.png`](../screenshots/01-rust-contract-tests.png) |
| Node.js application tests | 11 passed | [`../evidence/run-summary.json`](../evidence/run-summary.json) |
| Rust unit tests | 2 passed | [`../evidence/run-summary.json`](../evidence/run-summary.json) |
| `ckb-testtool` integration tests | 11 passed | [`../evidence/run-summary.json`](../evidence/run-summary.json) |
| Local contract deployment | Completed | [`../screenshots/02-contract-deployment.png`](../screenshots/02-contract-deployment.png) |
| `ACTIVE → REVOKED` lifecycle | Completed | [`../screenshots/03-local-offckb-success.png`](../screenshots/03-local-offckb-success.png) |

No separate scored CKB Academy module was recorded in this report. The evidence above documents practical developer-environment and capstone work.

## Work completed

- Configured a local OffCKB environment with prefunded development accounts.
- Implemented credential minting, verification, and revocation in Node.js.
- Added issuer, signature, recipient, identity-commitment, and document-hash checks.
- Implemented the Rust credential-revocation Type Script.
- Added positive and negative contract tests.
- Deployed the contract to the local OffCKB devnet.
- Created an on-chain `ACTIVE` record and consumed it into a `REVOKED` record.
- Added sanitized terminal evidence and screenshots.

## What I learned

- CKB application state is represented by Cells that are consumed and recreated rather than updated in place.
- Lock Scripts control authorization, while Type Scripts validate the structure and transition rules of application state.
- CKB contracts are compiled for the RISC-V-based CKB-VM target.
- `ckb-testtool` can verify both accepted and rejected state transitions without requiring a public network.
- Document hashes can bind an off-chain certificate file to a signed credential record.
- Private keys, `.env` files, identity salts, and raw personal identifiers must remain outside the public repository.

## Challenges and fixes

The main challenge was preparing the CKB Rust build environment. I encountered npm registry configuration problems, Rust atomic-lowering errors, and a missing RISC-V C cross-compiler. I documented each correction in the repository so another builder can reproduce the setup.

## Next step

The next step is to turn the local credential prototype into a public, read-only inspector that does not require an issuer private key and can provide reusable evidence to other CKB developers.
