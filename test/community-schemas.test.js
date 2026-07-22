import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (relative) => JSON.parse(fs.readFileSync(new URL(`../${relative}`, import.meta.url), "utf8"));

test("community JSON Schemas declare draft 2020-12 and stable identifiers", () => {
  const vectors = read("community/schemas/credential-cell-test-vectors-v1.schema.json");
  const proof = read("community/schemas/public-verification-proof-v2.schema.json");
  for (const schema of [vectors, proof]) {
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.match(schema.$id, /^https:\/\//);
    assert.equal(schema.type, "object");
    assert.equal(Array.isArray(schema.required), true);
  }
});

test("decoder manifest is explicitly an example and requires deployment replacement", () => {
  const manifest = read("community/decoder/decoder-manifest.example.json");
  assert.equal(manifest.status, "example-only");
  assert.equal(manifest.recordLength, 75);
  assert.match(manifest.typeScript.codeHash, /REPLACE_WITH_DEPLOYED_CODE_HASH/);
});
