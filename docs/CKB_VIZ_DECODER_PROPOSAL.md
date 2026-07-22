# Contribution-ready decoder proposal for CKB transaction tools

This document is an integration proposal, not evidence that an upstream project has accepted the decoder.

## User value

When a transaction contains the credential Type Script, a transaction visualizer could replace an opaque 75-byte hex value with:

```text
CKB Degree credential record
Status: REVOKED
Credential hash: 0x…
Issuer Lock Script hash: 0x…
Reason code: 2 (CREDENTIAL_REPLACED)
Revoked at: 2025-07-14T00:00:00.000Z
```

## Reusable artifacts

- `community/decoder/credential-cell-decoder.js`
- `community/test-vectors/credential-cell-v1.json`
- `docs/CREDENTIAL_CELL_DATA_FORMAT.md`

## Safe recognition

A generic explorer should not decode every 75-byte Cell as a credential. Recognition must first match the deployed Type Script code hash and hash type supplied by the relevant network deployment manifest. Unknown code hashes must remain unknown.

## Suggested upstream workflow

1. Open an issue with the binary specification and deterministic vectors.
2. Provide one public testnet transaction after an actual testnet deployment exists.
3. Ask the maintainer which decoder/plugin interface is appropriate.
4. Adapt the standalone decoder to that interface.
5. Add valid, malformed, and unknown-code-hash fixtures.
6. Keep the decoder labelled as a community protocol, not a built-in CKB standard.
