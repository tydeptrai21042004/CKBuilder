# CKBuilder Task Requirements Matrix

| Task expectation | Implementation | Verified evidence |
|---|---|---|
| Create an original application | Academic credential minting, validation, tamper detection, and revocation | `src/`; Node demo output |
| Write application code | Node.js CLI, services, schemas, cryptography, and CKB integration | `src/cli/`, `src/lib/`, `src/ckb/` |
| Build on CKB | Custom Rust CKB Type Script | `digital-credentials-workspace/contracts/credential-revocation/` |
| Advanced extension | Issuer-authorized irreversible revocation registry | `ACTIVE → REVOKED` contract logic |
| Protect private identity | Salted identity commitment; raw ID and salt omitted | Node privacy test |
| Verify document integrity | SHA-256 certificate comparison | Original/modified certificate tests |
| Authenticate issuer | Ed25519 signature, trusted issuer, and CKB Lock Script hash | Signature and untrusted-issuer tests |
| Prevent duplicate minting | Existing credential ID is rejected | Node negative test |
| Support revocation | Signed event plus 75-byte CKB Cell record | Node and on-chain lifecycle |
| Prevent reactivation | Rust Script rejects `REVOKED → ACTIVE` | Rust unit and integration tests |
| Reject unauthorized changes | Issuer Lock Script hash authorization | `reject_unauthorized_creation` |
| Reject malformed transitions | Negative contract tests | 11 CKB integration tests passed |
| Check environment automatically | `.env`, RPC, Node, and format validation | `scripts/check-env.sh` |
| Check toolchain automatically | Rust target and RISC-V C toolchain validation | `scripts/check-toolchain.sh` |
| Run everything automatically | Complete local OffCKB pipeline | `scripts/local-offckb-all.sh` |
| Prove deployment | Contract deployment transaction recorded | Screenshot 02; `evidence/run-summary.json` |
| Prove live state transition | Real ACTIVE Cell consumed into REVOKED Cell | Screenshot 03; sanitized log |
| Protect publication package | Secret/path audit and sanitized screenshots | `scripts/audit-release.sh`; screenshot security review |
| Maintain weekly reports | Personal report template | `reports/week-template.md` |
| Avoid real-fund risk | Local devnet only, public development key | README security boundary |

## Verified totals

- Node.js tests: **11/11 passed**
- Rust unit tests: **2/2 passed**
- Rust integration tests: **11/11 passed**
- Final local-chain state: **REVOKED**
