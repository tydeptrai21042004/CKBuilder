import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initializeIssuer, mintCredential, revokeCredential, verifyCredential } from "../src/lib/credential-service.js";
import { loadLedger, saveLedger } from "../src/lib/ledger.js";
import { decodeRevocationRecord, REVOCATION_RECORD_LENGTH } from "../src/lib/revocation-binary.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-degree-proof-"));
  const document = path.join(root, "original.pdf");
  const modified = path.join(root, "modified.pdf");
  fs.writeFileSync(document, "original certificate bytes");
  fs.writeFileSync(modified, "modified certificate bytes");
  const env = {
    ROOT_DIR: root,
    APP_NETWORK: "local",
    CKB_RPC_URL: "http://127.0.0.1:28114",
    ISSUER_NAME: "Test University",
    ISSUER_LOCK_HASH: `0x${"11".repeat(32)}`,
    DATA_DIR: path.join(root, "data"),
    ISSUER_PRIVATE_KEY_PATH: path.join(root, "secrets/private.pem"),
    ISSUER_PUBLIC_KEY_PATH: path.join(root, "secrets/public.pem"),
    TRUSTED_ISSUERS_FILE: path.join(root, "data/trusted.json"),
    REVOCATION_CONTRACT_BIN: path.join(root, "contract"),
    REQUIRE_CKB_RPC: false
  };
  const input = {
    credentialId: "TEST-2026-001",
    recipientLockHash: `0x${"22".repeat(32)}`,
    studentId: "PRIVATE-STUDENT-ID",
    identitySalt: "random-test-salt",
    degreeTitle: "Bachelor of Testing",
    fieldOfStudy: "Software Verification",
    classification: "Distinction",
    issuedAt: "2026-07-14"
  };
  initializeIssuer(env);
  return { root, env, input, document, modified };
}

test("valid credential passes all requested checks and omits raw identity", () => {
  const f = fixture();
  const record = mintCredential(f.env, f.input, f.document);
  const serialized = JSON.stringify(record);
  assert.equal(serialized.includes(f.input.studentId), false);
  assert.equal(serialized.includes(f.input.identitySalt), false);
  const result = verifyCredential(f.env, f.input.credentialId, f.document, {
    recipientLockHash: f.input.recipientLockHash,
    studentId: f.input.studentId,
    identitySalt: f.input.identitySalt
  });
  assert.equal(result.valid, true, JSON.stringify(result.checks));
});

test("modified document is rejected", () => {
  const f = fixture();
  mintCredential(f.env, f.input, f.document);
  const result = verifyCredential(f.env, f.input.credentialId, f.modified);
  assert.equal(result.valid, false);
  assert.equal(result.checks.some((c) => c.code === "DOCUMENT_HASH_MISMATCH"), true);
});

test("tampered signed payload is rejected", () => {
  const f = fixture();
  mintCredential(f.env, f.input, f.document);
  const ledger = loadLedger(f.env.DATA_DIR);
  ledger.credentials[f.input.credentialId].payload.award.title = "Forged Degree";
  saveLedger(f.env.DATA_DIR, ledger);
  const result = verifyCredential(f.env, f.input.credentialId, f.document);
  assert.equal(result.valid, false);
  assert.equal(result.checks.some((c) => c.code === "SIGNATURE_INVALID"), true);
});

test("unknown issuer is rejected", () => {
  const f = fixture();
  mintCredential(f.env, f.input, f.document);
  fs.writeFileSync(f.env.TRUSTED_ISSUERS_FILE, JSON.stringify({ schema: "ckb-degree-proof-trusted-issuers/v1", issuers: {} }));
  const result = verifyCredential(f.env, f.input.credentialId, f.document);
  assert.equal(result.valid, false);
  assert.equal(result.checks.some((c) => c.code === "UNTRUSTED_ISSUER"), true);
});

test("revoked credential is rejected and binary matches Rust layout", () => {
  const f = fixture();
  mintCredential(f.env, f.input, f.document);
  revokeCredential(f.env, f.input.credentialId, 7, "Academic misconduct", { revokedAt: "2026-07-14T01:00:00.000Z" });
  const result = verifyCredential(f.env, f.input.credentialId, f.document);
  assert.equal(result.valid, false);
  assert.equal(result.checks.some((c) => c.code === "CREDENTIAL_REVOKED"), true);
  const binary = fs.readFileSync(path.join(f.env.DATA_DIR, "revocations", `${f.input.credentialId}-revoked.bin`));
  assert.equal(binary.length, REVOCATION_RECORD_LENGTH);
  const decoded = decodeRevocationRecord(binary);
  assert.equal(decoded.status, 1);
  assert.equal(decoded.reasonCode, 7);
  assert.equal(decoded.issuerLockHash, f.env.ISSUER_LOCK_HASH);
});

test("duplicate mint and second revocation are rejected", () => {
  const f = fixture();
  mintCredential(f.env, f.input, f.document);
  assert.throws(() => mintCredential(f.env, f.input, f.document), (error) => error.code === "CREDENTIAL_ALREADY_EXISTS");
  revokeCredential(f.env, f.input.credentialId, 1, "Replacement issued");
  assert.throws(() => revokeCredential(f.env, f.input.credentialId, 1, "Again"), (error) => error.code === "CREDENTIAL_ALREADY_REVOKED");
});


test("local verifier detects attempted reactivation after a signed revocation", () => {
  const f = fixture();
  mintCredential(f.env, f.input, f.document);
  revokeCredential(f.env, f.input.credentialId, 2, "Revoked for testing");
  const ledger = loadLedger(f.env.DATA_DIR);
  ledger.credentials[f.input.credentialId].status = "ACTIVE";
  saveLedger(f.env.DATA_DIR, ledger);
  const result = verifyCredential(f.env, f.input.credentialId, f.document);
  assert.equal(result.valid, false);
  assert.equal(result.checks.some((c) => c.code === "REACTIVATION_DETECTED"), true);
});
