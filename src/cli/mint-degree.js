#!/usr/bin/env node
import path from "node:path";
import { env, loadInputJson, run } from "./common.js";
import { initializeIssuer, mintCredential } from "../lib/credential-service.js";

run(() => {
  const [inputFile, documentFile] = process.argv.slice(2);
  if (!inputFile || !documentFile) {
    throw new Error("Usage: npm run credential:mint -- <credential-input.json> <certificate.pdf>");
  }
  const config = env();
  initializeIssuer(config);
  const record = mintCredential(config, loadInputJson(inputFile), path.resolve(documentFile));
  console.log("Credential minted successfully.");
  console.log(`Credential ID: ${record.payload.credentialId}`);
  console.log(`Issuer ID: ${record.payload.issuer.issuerId}`);
  console.log(`Document SHA-256: ${record.payload.document.hash}`);
  console.log(`Status: ${record.status}`);
  console.log("Privacy check: raw studentId and identitySalt were not stored.");
});
