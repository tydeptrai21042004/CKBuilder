# Screenshot Security Review

The six screenshots in this directory were reviewed before inclusion.

## Checked for sensitive information

- issuer private-key values or PEM private-key blocks;
- seed phrases or wallet mnemonics;
- passwords, access tokens, API keys, or session cookies;
- `.env` contents;
- raw student identifiers or identity salts;
- production wallet or mainnet account information.

**Result:** none of those values appears in the screenshots.

## Redaction and processing

- all three Week 2 images were re-encoded as PNG files;
- the local Windows/WSL account path in `05-local-offckb-lifecycle-success.png` was replaced with `<PROJECT_ROOT>`;
- no technical pass/fail result, checksum, transaction hash, credential hash, code hash, or local-devnet address was changed.

## Values intentionally retained

The following values are retained as local-devnet technical evidence:

- OffCKB development address;
- issuer Lock Script hash;
- credential hash;
- local transaction hashes;
- contract code hash and checksum;
- test names and pass/fail output;
- loopback RPC and inspector addresses.

These values belong only to local OffCKB development networks. The associated prefunded development accounts must never be used with real assets.
