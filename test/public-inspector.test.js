import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeIssuer, mintCredential, revokeCredential } from "../src/lib/credential-service.js";
import { exportPublicProof, inspectPublicCredential } from "../src/lib/public-inspector.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-public-inspector-"));
  const document = path.join(root, "certificate.pdf");
  fs.writeFileSync(document, "public inspector certificate bytes");
  const env = {
    ROOT_DIR: root,
    APP_NETWORK: "devnet",
    CKB_RPC_URL: "http://127.0.0.1:28114",
    ISSUER_NAME: "Inspector University",
    ISSUER_LOCK_HASH: `0x${"11".repeat(32)}`,
    DATA_DIR: path.join(root, "data"),
    ISSUER_PRIVATE_KEY_PATH: path.join(root, "secrets/private.pem"),
    ISSUER_PUBLIC_KEY_PATH: path.join(root, "secrets/public.pem"),
    TRUSTED_ISSUERS_FILE: path.join(root, "data/trusted.json"),
    OFFCKB_CHAIN_STATE: path.join(root, "data/offckb-chain-state.json")
  };
  const input = {
    credentialId: "PUBLIC-2026-001",
    recipientLockHash: `0x${"22".repeat(32)}`,
    studentId: "PRIVATE-STUDENT-ID",
    identitySalt: "private-salt",
    degreeTitle: "Bachelor of Public Verification",
    fieldOfStudy: "CKB",
    issuedAt: "2026-07-22"
  };
  initializeIssuer(env);
  mintCredential(env, input, document, { createdAt: "2026-07-22T00:00:00.000Z" });
  return { root, env, input, document };
}

function chain(status) {
  return async () => ({
    found: status !== "NOT_FOUND",
    status,
    readOnly: true,
    records: [],
    issuerLockHash: `0x${"11".repeat(32)}`
  });
}

test("public inspector verifies an active credential without private-key settings", async () => {
  const f = fixture();
  const publicEnv = {
    APP_NETWORK: f.env.APP_NETWORK,
    CKB_RPC_URL: f.env.CKB_RPC_URL,
    ISSUER_LOCK_HASH: f.env.ISSUER_LOCK_HASH,
    DATA_DIR: f.env.DATA_DIR,
    TRUSTED_ISSUERS_FILE: f.env.TRUSTED_ISSUERS_FILE,
    OFFCKB_CHAIN_STATE: f.env.OFFCKB_CHAIN_STATE
  };
  const proof = await inspectPublicCredential(publicEnv, f.input.credentialId, {
    documentPath: f.document,
    chainInspector: chain("ACTIVE"),
    now: "2026-07-22T01:00:00.000Z"
  });
  assert.equal(proof.outcome, "ACTIVE_VALID");
  assert.equal(proof.privateKeyRequired, false);
  assert.equal(proof.proofVersion, "2.1.0");
  assert.equal(proof.formats.cellData, "ckb-degree-credential-cell/v1");
  assert.equal(proof.usableAsActiveCredential, true);
  assert.equal(JSON.stringify(proof).includes("PRIVATE-STUDENT-ID"), false);
  assert.match(proof.proofDigest, /^0x[0-9a-f]{64}$/);
});

test("public inspector reports a revoked but cryptographically intact credential", async () => {
  const f = fixture();
  revokeCredential(f.env, f.input.credentialId, 2, "Credential replaced", { revokedAt: "2026-07-22T02:00:00.000Z" });
  const proof = await inspectPublicCredential(f.env, f.input.credentialId, {
    documentPath: f.document,
    chainInspector: chain("REVOKED")
  });
  assert.equal(proof.outcome, "REVOKED");
  assert.equal(proof.offChain.integrityValid, true);
  assert.equal(proof.usableAsActiveCredential, false);
});

test("public inspector detects duplicate live chain records", async () => {
  const f = fixture();
  const proof = await inspectPublicCredential(f.env, f.input.credentialId, {
    documentPath: f.document,
    chainInspector: chain("CONFLICT_DUPLICATE")
  });
  assert.equal(proof.outcome, "CONFLICT_DUPLICATE");
  assert.equal(proof.stateConsistency.consistent, false);
});

test("public inspector can inspect metadata without a document but does not call it fully valid", async () => {
  const f = fixture();
  const proof = await inspectPublicCredential(f.env, f.input.credentialId, {
    chainInspector: chain("ACTIVE")
  });
  assert.equal(proof.outcome, "ACTIVE_DOCUMENT_NOT_CHECKED");
  assert.equal(proof.offChain.documentVerified, false);
  assert.equal(proof.offChain.complete, false);
  assert.equal(proof.usableAsActiveCredential, false);
});

test("public proof export writes the same proof object", async () => {
  const f = fixture();
  const proof = await inspectPublicCredential(f.env, f.input.credentialId, {
    documentPath: f.document,
    chainInspector: chain("ACTIVE"),
    now: "2026-07-22T01:00:00.000Z"
  });
  const output = path.join(f.root, "proof.json");
  exportPublicProof(output, proof);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, "utf8")), proof);
});

test("offline mode never claims complete on-chain validation", async () => {
  const f = fixture();
  const proof = await inspectPublicCredential(f.env, f.input.credentialId, {
    documentPath: f.document,
    skipChain: true
  });
  assert.equal(proof.outcome, "CHAIN_NOT_CHECKED");
  assert.equal(proof.usableAsActiveCredential, false);
  assert.equal(proof.stateConsistency.consistent, null);
});


test("public proof removes RPC credentials and internal error details", async () => {
  const f = fixture();
  const env = { ...f.env, CKB_RPC_URL: "https://user:secret@example.invalid/rpc?token=private" };
  const proof = await inspectPublicCredential(env, f.input.credentialId, {
    documentPath: f.document,
    chainInspector: async () => { throw new Error("/private/server/path/deployment.json missing"); }
  });
  assert.equal(proof.outcome, "RPC_UNAVAILABLE");
  assert.equal(proof.rpcUrl, "https://example.invalid/rpc");
  assert.equal(JSON.stringify(proof).includes("secret"), false);
  assert.equal(JSON.stringify(proof).includes("/private/server/path"), false);
});

test("on-chain record without a public credential is reported explicitly", async () => {
  const f = fixture();
  const missingId = "PUBLIC-2026-MISSING-OFFCHAIN";
  const proof = await inspectPublicCredential(f.env, missingId, {
    chainInspector: chain("ACTIVE")
  });
  assert.equal(proof.outcome, "OFFCHAIN_RECORD_NOT_FOUND");
});
