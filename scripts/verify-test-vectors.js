#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { decodeRevocationRecordJson } from "../src/lib/revocation-binary.js";
import { decodeCkbDegreeCellData } from "../community/decoder/credential-cell-decoder.js";

const input = path.resolve(process.argv[2] ?? "community/test-vectors/credential-cell-v1.json");
const corpus = JSON.parse(fs.readFileSync(input, "utf8"));
assert.equal(corpus.schema, "ckb-degree-cell-test-vectors/v1");
assert.equal(corpus.recordLength, 75);

for (const vector of corpus.vectors) {
  if (vector.name === "invalid-length") {
    assert.throws(() => decodeRevocationRecordJson(vector.cellData), /exactly 75 bytes/);
    assert.throws(() => decodeCkbDegreeCellData(vector.cellData), /Expected 75 bytes/);
    continue;
  }
  const canonical = decodeRevocationRecordJson(vector.cellData);
  const standalone = decodeCkbDegreeCellData(vector.cellData);
  assert.equal(canonical.canonical, vector.valid, vector.name);
  assert.equal(standalone.canonical, vector.valid, vector.name);
  assert.equal(standalone.version, canonical.version, vector.name);
  assert.equal(standalone.status, canonical.status, vector.name);
  assert.equal(standalone.credentialHash, canonical.credentialHash, vector.name);
  assert.equal(standalone.issuerLockHash, canonical.issuerLockHash, vector.name);
  assert.equal(standalone.reasonCode, canonical.reasonCode, vector.name);
  assert.equal(standalone.revokedAt, canonical.revokedAt, vector.name);
  assert.deepEqual(standalone.errors, canonical.errors, vector.name);
}

console.log(`Verified ${corpus.vectors.length} cross-implementation test vectors.`);
