# credential-revocation CKB Type Script

This contract enforces an issuer-authorized revocation registry for academic credentials.

## Cell data layout (75 bytes)

| Offset | Length | Field |
|---:|---:|---|
| 0 | 1 | version (`1`) |
| 1 | 1 | status (`0=ACTIVE`, `1=REVOKED`) |
| 2 | 32 | SHA-256 credential ID hash |
| 34 | 32 | issuer Lock Script hash |
| 66 | 1 | revocation reason code |
| 67 | 8 | revocation Unix timestamp, little-endian u64 |

The Type Script args must be exactly the 32-byte issuer Lock Script hash.

## Valid transitions

- Create: no group input and one group output in clean `ACTIVE` state.
- Update: one `ACTIVE` group input to one `REVOKED` group output.

## Rejected transitions

- Initial creation as revoked.
- Unauthorized creation or update.
- Reactivation from revoked to active.
- Credential ID or issuer mutation.
- Missing revocation reason or timestamp.
- Record destruction.
- More than one input or output in the Script group.
