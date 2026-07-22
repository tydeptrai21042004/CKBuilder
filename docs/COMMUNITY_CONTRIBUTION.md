# Community contribution package

The project now publishes reusable outputs beyond the credential application itself.

## 1. Standalone Cell-data decoder

`community/decoder/credential-cell-decoder.js` has no dependencies, wallet access, private keys, or RPC requirement. Explorer and visualization projects can adapt it to identify and decode this project's custom Cell data.

## 2. Cross-implementation test vectors

`community/test-vectors/credential-cell-v1.json` provides deterministic valid and invalid examples. A third-party decoder can use the file as a conformance corpus without running OffCKB.

## 3. Deployment recognition manifest

`npm run manifest:export -- <manifest.json>` exports the deployed Type Script code hash, hash type, issuer args example, specification, and test-vector locations. RPC metadata is omitted unless explicitly requested, and credentials/query strings are removed.

## 4. Machine-readable public proofs

The inspector exports `ckb-degree-public-verification-proof/v2`. `npm run proof:verify` recomputes its canonical digest and checks its public-data boundary.

## 5. Public HTTP endpoints

The no-wallet server exposes:

| Endpoint | Purpose |
|---|---|
| `GET /api/health` | Read-only service and supported-format discovery |
| `POST /api/inspect` | Credential/document/live-Cell inspection |
| `POST /api/decode-cell` | Raw 75-byte Cell-data decoding |
| `POST /api/verify-proof` | Exported-proof digest and privacy validation |

## 6. Useful community feedback

A productive issue or Nervos Talk post should include one concrete request:

- review the 75-byte field layout;
- test the vectors in another language;
- suggest a safe global-uniqueness design;
- report a Cell payload the decoder handles incorrectly;
- review an adapter for a transaction visualizer.

Do not describe the format as an official CKB standard. It is an open reference implementation produced by a CKBuilder participant.
