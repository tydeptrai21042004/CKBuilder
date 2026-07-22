import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { decodeRevocationRecordJson } from "../src/lib/revocation-binary.js";
import { decodeCkbDegreeCellData } from "../community/decoder/credential-cell-decoder.js";

const corpus = JSON.parse(fs.readFileSync(new URL("../community/test-vectors/credential-cell-v1.json", import.meta.url), "utf8"));

test("community corpus has stable metadata and both valid and invalid vectors", () => {
  assert.equal(corpus.schema, "ckb-degree-cell-test-vectors/v1");
  assert.equal(corpus.recordLength, 75);
  assert.equal(corpus.vectors.some((vector) => vector.valid), true);
  assert.equal(corpus.vectors.some((vector) => !vector.valid), true);
});

test("application and standalone community decoders agree on every vector", () => {
  for (const vector of corpus.vectors) {
    if (vector.name === "invalid-length") {
      assert.throws(() => decodeRevocationRecordJson(vector.cellData));
      assert.throws(() => decodeCkbDegreeCellData(vector.cellData));
      continue;
    }
    const application = decodeRevocationRecordJson(vector.cellData);
    const community = decodeCkbDegreeCellData(vector.cellData);
    assert.equal(community.canonical, application.canonical, vector.name);
    assert.equal(community.statusName, application.statusName, vector.name);
    assert.equal(community.credentialHash, application.credentialHash, vector.name);
    assert.equal(community.issuerLockHash, application.issuerLockHash, vector.name);
    assert.equal(community.reasonCode, application.reasonCode, vector.name);
    assert.equal(community.revokedAt, application.revokedAt, vector.name);
    assert.deepEqual(community.errors, application.errors, vector.name);
  }
});
