# Security notes

## Public Inspector boundary

The Public Credential Inspector is read-only. Its environment loader returns only public configuration and does not return either issuer private-key path. Public operations include credential verification, RPC Cell lookup, raw Cell-data decoding, and exported-proof verification.

The HTTP service adds:

- same-origin content security policy;
- frame denial and MIME sniffing protection;
- strict JSON content type;
- request and decoded-document limits;
- strict base64 validation;
- static path-traversal rejection;
- temporary document files created with owner-only permissions and removed after inspection;
- generic public error messages rather than local filesystem details.

## Contract control

Type Script arguments identify the issuer Lock Script hash. Creation and update require issuer authorisation, and the protected group input/output Cells must remain under that Lock Script.

## Secret handling

Never commit:

- `.env`;
- `secrets/`;
- issuer Ed25519 private keys;
- OffCKB, testnet, or mainnet signing keys;
- seed phrases or wallet exports;
- real student identifiers or identity salts.

The deterministic first OffCKB development key appears only as a known local test fixture. It is public and must never receive real funds.

## Public proof limitations

The proof digest detects later modification of the exported proof. It is not itself a blockchain signature and does not replace verification of issuer signatures, document hashes, or live RPC state.

## Protocol limitation

The contract prevents reactivation and lock reassignment within one registry Cell lineage. It still does not enforce global uniqueness against creating an independent new `ACTIVE` Cell with the same credential hash. The inspector therefore treats multiple live matches as a conflict.

## Reporting a vulnerability

Do not open a public issue containing real keys, private credentials, or exploitable deployment secrets. Share a minimal synthetic reproduction through the programme's official private channel first.
