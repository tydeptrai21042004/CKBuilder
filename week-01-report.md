# Week 1 Report — CKB Degree Proof

**Week ending:** 14 July 2026  
**Project:** CKB Degree Proof — Credential Revocation on CKB

## Summary

This week, I built and tested a local CKB application for issuing and revoking academic credentials. The project uses a Node.js application for credential creation and verification, together with a Rust CKB Type Script that enforces a per-Cell irreversible `ACTIVE → REVOKED` state transition.

## What I Learned

- How the CKB Cell Model represents application state.
- The difference between Lock Scripts and Type Scripts.
- How to use OffCKB to run a local CKB blockchain with prefunded development accounts.
- How to derive an issuer Lock Script hash and use it for authorization.
- How to build a CKB smart contract in Rust for the RISC-V target.
- How to use `ckb-testtool` for positive and negative contract tests.
- How to detect certificate modification using document hashes.
- Why private keys, `.env` files, student IDs, and identity salts must not be committed to GitHub.

## Work Completed

- Configured the local OffCKB environment automatically.
- Implemented credential minting, verification, and revocation logic.
- Added issuer, signature, recipient, identity commitment, and document-hash checks.
- Built the Rust credential-revocation Type Script.
- Passed 11 Node.js tests, 2 Rust unit tests, and 11 CKB integration tests.
- Deployed the contract to the local OffCKB devnet.
- Created an on-chain `ACTIVE` record and successfully changed it to `REVOKED`.
- Added sanitized screenshots and execution evidence to the repository.

## Challenges

The main challenge was preparing the CKB Rust build environment. I fixed issues involving npm registry URLs, Rust atomic lowering, and the missing RISC-V C cross-compiler. These problems helped me better understand how CKB contracts are compiled for CKB-VM.

## Next Week

Next week, I plan to improve the application interface, organize the documentation, and explore connecting the credential workflow with Spore DOBs.
