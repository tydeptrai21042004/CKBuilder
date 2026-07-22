# Standalone CKB Degree Cell decoder

`credential-cell-decoder.js` is a dependency-free reference decoder for the 75-byte `ckb-degree-credential-cell/v1` format.

It is intended for:

- CKB explorers and transaction visualizers;
- developer debugging tools;
- tutorials explaining Cell data layouts;
- independent verifier implementations.

The file is deliberately standalone. Copying it does not require the credential application, issuer keys, CCC, or an RPC connection.

```js
import { decodeCkbDegreeCellData } from "./credential-cell-decoder.js";

const result = decodeCkbDegreeCellData("0x...");
console.log(result.statusName, result.credentialHash);
```

See `../../docs/CREDENTIAL_CELL_DATA_FORMAT.md` and `../test-vectors/credential-cell-v1.json` for the normative layout and deterministic examples.
