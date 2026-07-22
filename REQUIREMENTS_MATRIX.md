# CKBuilder task and contribution matrix

## Capstone implementation

| Expectation | Implementation | Evidence |
|---|---|---|
| Create an original CKB application | Academic credential issuance, integrity verification, and revocation | `src/`, `digital-credentials-workspace/` |
| Build on CKB | Custom Rust Type Script and CCC integration | contract source and OffCKB commands |
| Protect identity | Salted identity commitment; raw student ID and salt omitted from public record | credential privacy tests |
| Verify document integrity | SHA-256 certificate comparison | original/modified-document tests |
| Authenticate issuer | Ed25519 signature, trusted issuer registry, CKB Lock Script hash | signature and trust tests |
| Support revocation | Signed event plus 75-byte Cell state | Node.js and Rust implementation |
| Enforce per-lineage state | Only issuer-owned `ACTIVE → REVOKED` update is accepted | Rust policy and tests |
| Prevent ordinary duplicates | Issuer client refuses an existing live matching record | `createActiveRecord` guard |
| Detect protocol conflicts | Public inspector returns duplicate/malformed conflicts | inspector and record tests |
| Public verification | No-private-key CLI, web interface, and HTTP API | `credential:inspect`, `inspector:serve` |
| Export evidence | Canonical proof JSON and proof digest | proof export and verifier tests |
| Reproducible local workflow | Environment checks, build, test, deploy, lifecycle | scripts and sanitized evidence |

## Real community contribution

| Contribution | Reusable result | Verification |
|---|---|---|
| Open binary specification | `docs/CREDENTIAL_CELL_DATA_FORMAT.md` | field layout and canonical rules |
| Standalone decoder | `community/decoder/credential-cell-decoder.js` | no dependency, wallet, key, or RPC |
| Cross-language corpus | six deterministic valid/invalid vectors | `npm run test:vectors` |
| Decoder CLI/API | raw Cell data can be decoded independently | `cell:decode`, `/api/decode-cell` |
| Proof verifier CLI/API | detects proof modification and public-data leakage | `proof:verify`, `/api/verify-proof` |
| Contribution process | issue forms, PR template, contribution guide | `.github/`, `CONTRIBUTING.md` |
| Upstream preparation | safe transaction-visualizer decoder proposal | `docs/CKB_VIZ_DECODER_PROPOSAL.md` |

## Handbook compliance evidence

| Handbook requirement | Repository support | Current evidence status |
|---|---|---|
| Weekly contemporaneous GitHub report | evidence-first report templates | participant must publish personally each week |
| Course/module completion and scores | `learning/academy/` structure | not yet recorded |
| CCC Playground work | dedicated evidence directory | not yet recorded |
| Screenshots for practical work | screenshots and evidence folders | capstone evidence exists; course evidence still needed |
| Developer environment | automated local environment and OffCKB setup | substantially evidenced |
| Capstone application | working prototype and community package | implemented; public feedback still needed |

See `HANDBOOK_PROGRESS.md`. Do not mark missing course work as completed based only on capstone code.

## Test inventory after v2.1 changes

- JavaScript: **61 test cases**; current packaging run: **60 passed, 1 CCC test skipped, 0 failed**.
- Rust contract: **5 unit tests** and **18 `ckb-testtool` integration tests** in source.
- Community conformance: **6 vectors**, checked by two independent JavaScript decoders.

The new Rust binary must be rebuilt and the local lifecycle rerun before publishing new deployment evidence.
