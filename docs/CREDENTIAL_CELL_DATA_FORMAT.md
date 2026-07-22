# CKB Degree Credential Cell Data Format v1

## Status

Community reference format for the CKB Degree Proof learning project. It is not an official Nervos standard.

- Protocol identifier: `ckb-degree-credential-cell/v1`
- Exact length: **75 bytes**
- Integer byte order: little-endian for `revoked_at`
- Reference encoder/decoder: `src/lib/revocation-binary.js`
- Standalone decoder: `community/decoder/credential-cell-decoder.js`
- Deterministic corpus: `community/test-vectors/credential-cell-v1.json`

## Binary layout

| Offset | Length | Field | Encoding |
|---:|---:|---|---|
| 0 | 1 | `version` | Unsigned byte; currently `1` |
| 1 | 1 | `status` | `0 = ACTIVE`, `1 = REVOKED` |
| 2 | 32 | `credential_hash` | SHA-256 of the UTF-8 credential ID |
| 34 | 32 | `issuer_lock_hash` | CKB Lock Script hash authorised by Type Script args |
| 66 | 1 | `reason_code` | `0` for active; non-zero for revoked |
| 67 | 8 | `revoked_at` | Unsigned Unix seconds, little-endian `u64` |

## Canonical states

### ACTIVE

```text
version = 1
status = 0
reason_code = 0
revoked_at = 0
```

### REVOKED

```text
version = 1
status = 1
reason_code != 0
revoked_at != 0
```

## Reason-code registry

| Code | Meaning |
|---:|---|
| 1 | Administrative correction |
| 2 | Credential replaced |
| 3 | Issued in error |
| 4 | Academic misconduct |
| 5 | Legal or policy requirement |
| 255 | Other |

Values `6–254` are unregistered extension values. Decoders must preserve the numeric value and should label it `UNREGISTERED`, not invent a meaning.

## Contract rules

The Rust Type Script currently enforces:

1. Type Script args are exactly the 32-byte issuer Lock Script hash.
2. An issuer-authorised input is required for creation and update.
3. The protected group input and output Cells remain locked by that issuer.
4. Creation has no group input and exactly one canonical `ACTIVE` output.
5. Update has one group input and one group output.
6. Credential hash, version, and issuer hash are immutable within a lineage.
7. The only accepted transition is `ACTIVE → REVOKED`.
8. A protected record cannot be destroyed.

## Deliberate limitation

This shared Type Script does not enforce global uniqueness for a credential hash across independently created Cell lineages. Clients must prevent duplicate creation, and public inspectors must report multiple live matching Cells as a conflict.

## Conformance requirement

A decoder claiming compatibility should pass every vector in:

```text
community/test-vectors/credential-cell-v1.json
```

Run:

```bash
npm run test:vectors
```

The corpus contains canonical active/revoked records and malformed status, field, and length cases. The application decoder and the dependency-free community decoder are checked against the same corpus.
