# Screenshot Security Review

The three screenshots in this directory were reviewed and sanitized before inclusion.

## Checked for sensitive information

- private-key values or PEM private-key blocks;
- seed phrases or wallet mnemonics;
- passwords, access tokens, API keys, or session cookies;
- `.env` contents;
- raw student identifiers or identity salts;
- secret signing material.

**Result:** none of those values appears in the screenshots.

## Redactions applied

- the local Windows/WSL filesystem path;
- the local Windows account identifier contained in that path;
- local artifact paths that are not needed as technical evidence.

The PNG files were re-encoded after redaction, which removed incidental PNG metadata.

## Values intentionally retained

The following are not secrets and are retained as local-devnet evidence:

- OffCKB development address;
- issuer Lock Script hash;
- credential hash;
- local transaction hashes;
- contract code hash/checksum;
- test names and pass/fail output.

These values belong to a local OffCKB development chain. The associated development account is publicly known and must never be used with real assets.
