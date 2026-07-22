# Verified Local Execution Evidence

This directory records the successful original capstone execution completed on **14 July 2026** using the local OffCKB devnet.

## Included files

- `run-summary.json` — machine-readable summary of the verified run;
- `local-offckb-run-sanitized.log` — complete terminal log with local usernames and filesystem paths removed.

The visual evidence is stored in [`../screenshots`](../screenshots/).

## Verified outcome

- Node.js tests: **11 passed, 0 failed**;
- Rust contract unit tests: **2 passed, 0 failed**;
- CKB integration tests: **11 passed, 0 failed**;
- contract deployed successfully to local OffCKB;
- an `ACTIVE` registry Cell was created;
- the `ACTIVE` Cell was consumed into a `REVOKED` Cell;
- the final live Cell was queried and confirmed as `REVOKED`.

All transaction hashes in this directory refer only to the ephemeral local OffCKB chain. They are not public testnet or mainnet transactions.

## v2 Public Credential Inspector evidence

- `v2-node-tests.txt` — **23 passing** dependency-free Node.js tests;
- `v2-offline-inspector.txt` — CLI document verification and proof export with live-chain checking explicitly skipped;
- `v2-inspector-smoke-summary.json` — browser/API smoke result recorded while issuer private-key files were absent.

The v2 evidence does not claim a new full OffCKB deployment. The original live-chain evidence remains the 14 July run above; the new full CCC/OffCKB lifecycle should be rerun in the target environment after `npm ci`.
