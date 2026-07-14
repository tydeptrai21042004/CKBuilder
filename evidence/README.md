# Verified Local Execution Evidence

This directory records the successful Level-2 execution completed on **14 July 2026** using the local OffCKB devnet.

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
