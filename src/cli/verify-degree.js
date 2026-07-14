#!/usr/bin/env node
import path from "node:path";
import { env, run } from "./common.js";
import { verifyCredential } from "../lib/credential-service.js";

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

run(() => {
  const [credentialId, documentFile] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (!credentialId || !documentFile) {
    throw new Error("Usage: npm run credential:verify -- <credential-id> <certificate.pdf> [--recipient=0x...] [--student-id=...] [--salt=...]");
  }
  const result = verifyCredential(env(), credentialId, path.resolve(documentFile), {
    recipientLockHash: option("recipient"),
    studentId: option("student-id"),
    identitySalt: option("salt")
  });
  for (const check of result.checks) {
    console.log(`${check.ok ? "[PASS]" : "[FAIL]"} ${check.name}: ${check.message}`);
  }
  console.log(`\nRESULT: ${result.valid ? "VALID" : "INVALID"}`);
  if (!result.valid) process.exitCode = 2;
});
