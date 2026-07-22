import assert from "node:assert/strict";
import test from "node:test";
import { buildDecoderManifest, DECODER_MANIFEST_SCHEMA } from "../src/lib/decoder-manifest.js";

const env = {
  APP_NETWORK: "testnet",
  CKB_RPC_URL: "https://user:secret@example.invalid/rpc",
  ISSUER_LOCK_HASH: `0x${"11".repeat(32)}`
};
const contract = { codeHash: `0x${"22".repeat(32)}`, hashType: "data2", cellDeps: [] };

test("decoder manifest binds recognition to a deployed Type Script", () => {
  const manifest = buildDecoderManifest(env, { contract, generatedAt: "2026-07-22T00:00:00.000Z" });
  assert.equal(manifest.schema, DECODER_MANIFEST_SCHEMA);
  assert.equal(manifest.typeScript.codeHash, contract.codeHash);
  assert.equal(manifest.typeScript.exampleArgs, env.ISSUER_LOCK_HASH);
  assert.equal(manifest.recordLength, 75);
  assert.equal(manifest.officialStandard, false);
  assert.equal(manifest.rpcUrl, undefined);
  assert.equal(JSON.stringify(manifest).includes("rpcUrl"), false);
});

test("decoder manifest includes RPC only when explicitly requested", () => {
  const manifest = buildDecoderManifest(env, { contract, includeRpcUrl: true });
  assert.equal(manifest.rpcUrl, "https://example.invalid/rpc");
});

test("decoder manifest rejects malformed deployment metadata", () => {
  assert.throws(() => buildDecoderManifest(env, { contract: { codeHash: "0x12", hashType: "data2" } }), /codeHash/);
  assert.throws(() => buildDecoderManifest(env, { contract: { codeHash: contract.codeHash, hashType: "unknown" } }), /hashType/);
  assert.throws(() => buildDecoderManifest({ ...env, ISSUER_LOCK_HASH: "0x12" }, { contract }), /ISSUER_LOCK_HASH/);
});
