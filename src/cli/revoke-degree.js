#!/usr/bin/env node
import { env, run } from "./common.js";
import { revokeCredential } from "../lib/credential-service.js";

run(() => {
  const [credentialId, reasonCodeRaw, ...reasonParts] = process.argv.slice(2);
  if (!credentialId || !reasonCodeRaw || reasonParts.length === 0) {
    throw new Error('Usage: npm run credential:revoke -- <credential-id> <reason-code 1..255> "<reason>"');
  }
  const reasonCode = Number(reasonCodeRaw);
  const revocation = revokeCredential(env(), credentialId, reasonCode, reasonParts.join(" "));
  console.log("Credential revoked successfully.");
  console.log(`Credential ID: ${credentialId}`);
  console.log(`Reason code: ${revocation.event.reasonCode}`);
  console.log(`Reason: ${revocation.event.reason}`);
  console.log(`Revoked at: ${revocation.event.revokedAt}`);
});
