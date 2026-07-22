import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildKnownScripts, loadContractInfo } from "../src/ckb/offckb-config.js";

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

test("OffCKB system-script parser produces CCC-compatible known Script keys", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-local-config-"));
  const systemPath = path.join(dir, "system.json");
  fs.writeFileSync(systemPath, JSON.stringify({ devnet: {
    secp256k1_blake160_sighash_all: { script: SECP },
    dao: { script: DAO }
  } }));
  const known = buildKnownScripts(systemPath);
  assert.equal(known.Secp256k1Blake160.codeHash, SECP.codeHash);
  assert.equal(known.NervosDao.codeHash, DAO.codeHash);
  assert.equal(known.TypeId.hashType, "type");
});

test("OffCKB parser rejects missing required system Scripts", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-local-config-missing-"));
  const systemPath = path.join(dir, "system.json");
  fs.writeFileSync(systemPath, JSON.stringify({ devnet: {} }));
  assert.throws(() => buildKnownScripts(systemPath), /Required devnet known Script/);
});

test("deployment parser accepts the OffCKB scripts.json structure", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-deployment-"));
  const deploymentPath = path.join(dir, "scripts.json");
  const info = {
    codeHash: `0x${"33".repeat(32)}`,
    hashType: "data2",
    cellDeps: [{ cellDep: { outPoint: { txHash: `0x${"44".repeat(32)}`, index: 0 }, depType: "code" } }]
  };
  fs.writeFileSync(deploymentPath, JSON.stringify({ devnet: { "credential-revocation": info } }));
  assert.deepEqual(loadContractInfo(deploymentPath), info);
});

test("deployment parser accepts a binary-suffixed contract name", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-deployment-bin-"));
  const deploymentPath = path.join(dir, "scripts.json");
  const info = { codeHash: `0x${"55".repeat(32)}`, hashType: "data2", cellDeps: [{}] };
  fs.writeFileSync(deploymentPath, JSON.stringify({ devnet: { "credential-revocation.bin": info } }));
  assert.deepEqual(loadContractInfo(deploymentPath), info);
});
