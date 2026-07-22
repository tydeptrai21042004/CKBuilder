import assert from "node:assert/strict";
import test from "node:test";
import { PUBLIC_PROOF_SCHEMA } from "../src/lib/public-inspector.js";
import { publicProofDigest, verifyPublicProof } from "../src/lib/proof-verifier.js";

function fixture() {
  const proof = {
    schema: PUBLIC_PROOF_SCHEMA,
    generatedAt: "2026-07-22T00:00:00.000Z",
    credentialId: "PROOF-001",
    readOnly: true,
    privateKeyRequired: false,
    outcome: "ACTIVE_VALID",
    offChain: { status: "ACTIVE" },
    onChain: { status: "ACTIVE" }
  };
  return { ...proof, proofDigest: publicProofDigest(proof) };
}

test("proof verifier accepts an untampered canonical proof", () => {
  const result = verifyPublicProof(fixture());
  assert.equal(result.valid, true);
  assert.equal(result.privacyIssues.length, 0);
});

test("proof verifier detects content tampering", () => {
  const proof = fixture();
  proof.outcome = "REVOKED";
  const result = verifyPublicProof(proof);
  assert.equal(result.valid, false);
  assert.equal(result.checks.find((check) => check.name === "proof_digest").ok, false);
});

test("proof verifier detects unsupported schema", () => {
  const proof = fixture();
  proof.schema = "other/v1";
  proof.proofDigest = publicProofDigest(proof);
  assert.equal(verifyPublicProof(proof).checks.find((check) => check.name === "schema").ok, false);
});

test("proof verifier reports sensitive fields and local absolute paths", () => {
  const proof = fixture();
  proof.privateKey = "0xdeadbeef";
  proof.debugPath = "/home/alice/private/data.json";
  proof.proofDigest = publicProofDigest(proof);
  const result = verifyPublicProof(proof);
  assert.equal(result.valid, false);
  assert.equal(result.privacyIssues.some((issue) => issue.code === "SENSITIVE_FIELD_PRESENT"), true);
  assert.equal(result.privacyIssues.some((issue) => issue.code === "ABSOLUTE_PATH_PRESENT"), true);
});

test("proof verifier rejects invalid timestamps and non-object inputs", () => {
  const proof = fixture();
  proof.generatedAt = "not-a-date";
  proof.proofDigest = publicProofDigest(proof);
  assert.equal(verifyPublicProof(proof).valid, false);
  assert.equal(verifyPublicProof(null).valid, false);
});
