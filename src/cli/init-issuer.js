#!/usr/bin/env node
import { env, run } from "./common.js";
import { initializeIssuer } from "../lib/credential-service.js";

run(() => {
  const config = env();
  const result = initializeIssuer(config);
  console.log(result.created ? "Issuer keypair created." : "Issuer keypair already exists; no key was overwritten.");
  console.log(`Issuer: ${config.ISSUER_NAME}`);
  console.log(`Issuer ID: ${result.issuerId}`);
  console.log(`Issuer CKB lock hash: ${config.ISSUER_LOCK_HASH}`);
  console.log(`Trusted issuer registry: ${config.TRUSTED_ISSUERS_FILE}`);
});
