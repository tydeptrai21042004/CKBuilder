# Verification Status

## Fully executed local OffCKB run

A complete automated run succeeded on **14 July 2026**.

| Verification | Result |
|---|---:|
| Environment validation | Passed |
| Public npm registry access | Passed |
| OffCKB startup and RPC health | Passed |
| Issuer Lock Script hash derivation | Passed |
| Node.js tests | **11 passed, 0 failed** |
| Original certificate demo | `VALID` |
| Modified certificate demo | `INVALID` |
| Post-revocation certificate demo | `INVALID` |
| Rust contract compilation | Passed |
| Rust unit tests | **2 passed, 0 failed** |
| CKB integration tests | **11 passed, 0 failed** |
| Local contract deployment | Passed |
| ACTIVE record creation | Passed |
| ACTIVE → REVOKED transition | Passed |
| Final live Cell query | `REVOKED` confirmed |
| Contract binary SHA-256 | Generated |

## Evidence

- Screenshots: [`screenshots/`](screenshots/)
- Sanitized complete log: [`evidence/local-offckb-run-sanitized.log`](evidence/local-offckb-run-sanitized.log)
- Machine-readable summary: [`evidence/run-summary.json`](evidence/run-summary.json)

## Scope

All network operations used the local OffCKB devnet. No testnet or mainnet record was created. Local transaction hashes may disappear when the local chain data is reset.
