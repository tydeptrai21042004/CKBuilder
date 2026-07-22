import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { PUBLIC_PROOF_SCHEMA } from "../src/lib/public-inspector.js";
import { publicProofDigest } from "../src/lib/proof-verifier.js";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const corpus = JSON.parse(fs.readFileSync(path.join(root, "community/test-vectors/credential-cell-v1.json"), "utf8"));

function run(script, args = [], env = {}) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

test("Cell decoder CLI returns canonical JSON for a valid vector", () => {
  const result = run("src/cli/decode-cell-data.js", [corpus.vectors[0].cellData]);
  assert.equal(result.status, 0, result.stderr);
  const decoded = JSON.parse(result.stdout);
  assert.equal(decoded.canonical, true);
  assert.equal(decoded.statusName, "ACTIVE");
});

test("Cell decoder CLI returns non-zero for non-canonical data", () => {
  const result = run("src/cli/decode-cell-data.js", [corpus.vectors.find((item) => item.name === "invalid-status").cellData]);
  assert.equal(result.status, 1);
  assert.equal(JSON.parse(result.stdout).errors.includes("INVALID_STATUS"), true);
});

test("proof verifier CLI accepts a valid proof and rejects a modified one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-proof-cli-"));
  const file = path.join(dir, "proof.json");
  const core = {
    schema: PUBLIC_PROOF_SCHEMA,
    generatedAt: "2026-07-22T00:00:00.000Z",
    credentialId: "CLI-PROOF-001",
    readOnly: true,
    privateKeyRequired: false,
    outcome: "CHAIN_NOT_CHECKED"
  };
  fs.writeFileSync(file, JSON.stringify({ ...core, proofDigest: publicProofDigest(core) }));
  const valid = run("src/cli/verify-public-proof.js", [file]);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(JSON.parse(valid.stdout).valid, true);

  const modified = JSON.parse(fs.readFileSync(file, "utf8"));
  modified.outcome = "REVOKED";
  fs.writeFileSync(file, JSON.stringify(modified));
  const invalid = run("src/cli/verify-public-proof.js", [file]);
  assert.equal(invalid.status, 1);
  assert.equal(JSON.parse(invalid.stdout).valid, false);
});

test("test-vector generator is deterministic", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-vector-generator-"));
  const output = path.join(dir, "vectors.json");
  const result = run("scripts/generate-test-vectors.js", [output]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, "utf8")), corpus);
});
