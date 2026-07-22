import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const FIRST_OFFCKB_KEY = "0x6109170b275a09ad54877b82f7d9930f88cab5717d484fb4741ae9d1dd078cd6";
const EXPECTED_LOCK_HASH = "0x7de82d61a7eb2ec82b0dc653e558ba120efcbfbb44dac87c12972d05bf250653";
const SECP = {
  codeHash: "0x9bd7e06f3ecf4be0f2fcd2188b23f1b9fcc88e5d4b65a8637b17723bbda3cce8",
  hashType: "type",
  cellDeps: [{ cellDep: { outPoint: { txHash: `0x${"11".repeat(32)}`, index: 0 }, depType: "depGroup" } }]
};
const DAO = {
  codeHash: "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
  hashType: "type",
  cellDeps: [{ cellDep: { outPoint: { txHash: `0x${"22".repeat(32)}`, index: 2 }, depType: "code" } }]
};

test("CCC derives the expected first OffCKB account Lock Script hash", async (t) => {
  try {
    await import("@ckb-ccc/core");
  } catch {
    t.skip("@ckb-ccc/core is not installed; run npm ci for this integration test.");
    return;
  }
  const { deriveIssuer } = await import("../src/ckb/local-chain.js");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-local-ccc-"));
  const systemPath = path.join(dir, "system.json");
  const keyPath = path.join(dir, "key");
  fs.writeFileSync(systemPath, JSON.stringify({ devnet: {
    secp256k1_blake160_sighash_all: { script: SECP },
    dao: { script: DAO }
  } }));
  fs.writeFileSync(keyPath, `${FIRST_OFFCKB_KEY}\n`, { mode: 0o600 });
  const issuer = await deriveIssuer({
    OFFCKB_SYSTEM_SCRIPTS: systemPath,
    CKB_ISSUER_PRIVATE_KEY_FILE: keyPath,
    CKB_RPC_URL: "http://127.0.0.1:28114"
  });
  assert.equal(issuer.lockHash, EXPECTED_LOCK_HASH);
  assert.match(issuer.address, /^ckt1/);
});
