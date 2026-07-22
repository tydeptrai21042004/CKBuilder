# CKBuilder submission checklist

## Engineering

- [x] Working Node.js credential application
- [x] Public read-only credential inspector
- [x] No issuer private key required for verification
- [x] Document integrity and public proof export
- [x] Independent proof verification
- [x] Duplicate/conflicting live Cell detection
- [x] Revocation event bound to credential and issuer
- [x] Hardened HTTP security and upload handling
- [x] Custom Rust CKB Type Script
- [x] Registry input/output remains under issuer Lock Script
- [x] Positive and negative application tests
- [x] Expanded Rust unit/integration test source
- [x] Automatic environment and toolchain validation
- [x] GitHub Actions for Node.js and Rust
- [x] `.gitignore`, `.env.example`, `LICENSE`, and security notes

## Community contribution

- [x] Written 75-byte Cell-data specification
- [x] Dependency-free standalone decoder
- [x] Deterministic valid and malformed test vectors
- [x] Decoder CLI and HTTP endpoint
- [x] Contribution guide and issue templates
- [x] Upstream decoder proposal prepared
- [ ] Deploy the hardened contract and create a fresh public testnet fixture
- [ ] Open a real community issue/post with one specific review request
- [ ] Record feedback and the resulting code/documentation change

## Handbook evidence

- [ ] Publish the current weekly report on the chosen day
- [ ] Record exact CKB Academy modules and scores
- [ ] Record CCC Playground exercises with screenshots
- [ ] Explain Cell Model concepts in the participant's own words
- [ ] Distinguish OffCKB devnet from a synchronized CKB full node
- [ ] Add the final GitHub repository URL

Before publishing:

```bash
npm run ci:local
```

Before claiming the new contract version is deployment-tested:

```bash
bash scripts/local-offckb-all.sh
```
