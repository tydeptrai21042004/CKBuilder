#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { env, loadInputJson, rootDir, run } from "./common.js";
import { initializeIssuer, mintCredential, revokeCredential, verifyCredential } from "../lib/credential-service.js";

run(() => {
  const config = env();
  const root = rootDir();
  for (const entry of ["ledger.json", "credentials", "revocations"]) {
    fs.rmSync(path.join(config.DATA_DIR, entry), { recursive: true, force: true });
  }
  initializeIssuer(config);
  const baseInput = loadInputJson(path.join(root, "examples/degree-input.json"));
  const input = {
    ...baseInput,
    credentialId: process.env.DEMO_CREDENTIAL_ID?.trim() || baseInput.credentialId
  };
  const original = path.join(root, "examples/certificate-original.pdf");
  const modified = path.join(root, "examples/certificate-modified.pdf");

  console.log(`\nCredential ID for this complete demo: ${input.credentialId}`);
  console.log("\n=== 1. MINT ===");
  const record = mintCredential(config, input, original, { createdAt: "2026-07-14T00:00:00.000Z" });
  console.log(`Minted ${record.payload.credentialId} as ${record.status}.`);

  console.log("\n=== 2. VERIFY ORIGINAL ===");
  print(verifyCredential(config, input.credentialId, original, {
    recipientLockHash: input.recipientLockHash,
    studentId: input.studentId,
    identitySalt: input.identitySalt
  }));

  console.log("\n=== 3. VERIFY MODIFIED DOCUMENT ===");
  print(verifyCredential(config, input.credentialId, modified));

  console.log("\n=== 4. REVOKE ===");
  revokeCredential(config, input.credentialId, 1, "Credential replaced after an administrative correction.", {
    revokedAt: "2026-07-14T01:00:00.000Z"
  });
  console.log("Revocation recorded and 75-byte CKB Cell data generated.");

  console.log("\n=== 5. VERIFY AFTER REVOCATION ===");
  print(verifyCredential(config, input.credentialId, original));

  console.log("\nDemo complete. Expected results: original valid, modified invalid, revoked invalid.");
});

function print(result) {
  for (const check of result.checks) console.log(`${check.ok ? "[PASS]" : "[FAIL]"} ${check.name}`);
  console.log(`RESULT: ${result.valid ? "VALID" : "INVALID"}`);
}
