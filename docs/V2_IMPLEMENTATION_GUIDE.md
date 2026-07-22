# v2 implementation guide — existing structure retained

## Design rule

CKB Degree Proof v2 extends the Week 1 repository in place. No original application, contract, evidence, test, or reporting directory is moved or replaced.

## Added files

| Existing area | v2 addition | Responsibility |
|---|---|---|
| `src/lib/` | `public-inspector.js` | Combines public credential checks, live Cell state, consistency, history, and proof export |
| `src/ckb/` | `record-inspection.js` | Pure validation and conflict summarization for decoded Cell records |
| `src/cli/` | `public-inspect.js` | Read-only CLI |
| `src/cli/` | `public-inspector-server.js` | Small built-in HTTP server; no framework required |
| root | `public/` | No-build browser interface |
| `test/` | `public-inspector.test.js` | Public proof and no-private-key tests |
| `test/` | `record-inspection.test.js` | Duplicate, invalid, active and revoked state tests |

## Modified existing files

### `src/lib/env.js`

The original `loadEnv()` remains for issuer operations. A second loader, `loadPublicInspectorEnv()`, returns only whitelisted public values. It does not return either private-key path even when those variables exist in `.env`.

### `src/ckb/local-chain.js`

The original signing context remains for create/revoke operations. `createPublicDevnetContext()` and `inspectRecord()` use only RPC, system script metadata, deployment metadata, issuer Lock Script hash and Type Script.

### `src/lib/credential-service.js`

The original mint/revoke/verify API remains. The following correctness fixes were added:

- validate a real calendar date during mint;
- validate and encode a revocation timestamp before persistent mutation;
- rollback the ledger if final binary commit fails;
- bind signed revocation evidence to the same credential and issuer;
- produce collision-resistant artifact file names;
- expose `verifyCredentialPublic()` for read-only inspection.

## Runtime flow

```text
Credential ID + optional certificate
              |
              v
Public credential record and trusted issuer registry
              |
              v
Signature, schema, binding and document-hash checks
              |
              v
Read-only CKB RPC/indexer query by Type Script
              |
              v
ACTIVE / REVOKED / NOT_FOUND / INVALID / CONFLICT
              |
              v
Off-chain versus on-chain consistency check
              |
              v
Exportable verification proof + digest
```

## Commands

### Existing issuer workflow

```bash
npm run issuer:init
npm run credential:mint -- examples/degree-input.json examples/certificate-original.pdf
npm run credential:revoke -- CKB-DEGREE-2026-0001 1 "Administrative correction"
```

### New public CLI

```bash
npm run credential:inspect -- \
  CKB-DEGREE-2026-0001 \
  examples/certificate-original.pdf \
  --export=data/verification-proof.json
```

The public CLI can be run without an issuer private key. Live chain inspection still requires the public system/deployment JSON files and a reachable RPC endpoint.

### New browser tool

```bash
npm run inspector:serve
```

Open `http://127.0.0.1:4173`.

## Week 2 handbook alignment

Use the implementation as evidence only for work actually completed. The weekly report should separately show:

1. the CKB Academy or handbook material studied;
2. at least one CCC Playground or Cell-data exercise;
3. commands and screenshots from this inspector;
4. a personal explanation of signer versus read-only client;
5. the difference between per-Cell irreversibility and global uniqueness;
6. a specific community feedback request.

The implementation does not replace the required contemporaneous GitHub report.

## Continuous integration

`.github/workflows/node-tests.yml` installs the pinned dependencies, checks JavaScript syntax, runs the complete Node.js suite, and runs the release audit on pushes and pull requests.

## v2.1 additions without restructuring

| Existing area | v2.1 addition | Responsibility |
|---|---|---|
| `src/lib/` | `inspector-http.js` | Testable hardened HTTP service |
| `src/lib/` | `proof-verifier.js` | Independent canonical proof verification |
| `src/lib/` | `decoder-manifest.js` | Deployment-specific decoder recognition metadata |
| `src/lib/` | expanded `revocation-binary.js` | Strict codec, canonical validation, reason registry |
| `src/cli/` | `decode-cell-data.js` | Raw Cell-data decoder CLI |
| `src/cli/` | `verify-public-proof.js` | Exported-proof verifier CLI |
| `src/cli/` | `export-decoder-manifest.js` | Explorer/visualizer manifest export |
| root | `community/` | Standalone decoder, schemas, manifest example and vectors |
| `test/` | codec/proof/HTTP/CLI/schema tests | Community conformance and security regression coverage |
| Rust contract | output-lock ownership check | Protected registry Cells remain controlled by issuer |

The existing issuer commands, repository directories, evidence, screenshots, and local lifecycle scripts remain in their original locations.
