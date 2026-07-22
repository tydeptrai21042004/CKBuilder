#!/usr/bin/env node
import path from "node:path";
import { loadPublicInspectorEnv } from "../lib/env.js";
import { exportPublicProof, inspectPublicCredential } from "../lib/public-inspector.js";
import { formatError } from "../lib/errors.js";
import { rootDir } from "./common.js";

function option(name) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const positionals = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const [credentialId, documentFile] = positionals;
  if (!credentialId) {
    throw new Error(
      "Usage: npm run credential:inspect -- <credential-id> [certificate.pdf] [--export=proof.json] [--offline]"
    );
  }

  const config = loadPublicInspectorEnv(rootDir());
  const proof = await inspectPublicCredential(config, credentialId, {
    documentPath: documentFile ? path.resolve(documentFile) : undefined,
    skipChain: process.argv.includes("--offline")
  });

  console.log(`Outcome: ${proof.outcome}`);
  console.log(`Read-only: ${proof.readOnly ? "yes" : "no"}`);
  console.log(`Private key required: ${proof.privateKeyRequired ? "yes" : "no"}`);
  console.log(`Off-chain status: ${proof.offChain.status ?? "NOT_FOUND"}`);
  console.log(`On-chain status: ${proof.onChain.status}`);
  console.log(`Document verified: ${proof.offChain.documentVerified ? "yes" : "no"}`);
  console.log(`State consistency: ${proof.stateConsistency.consistent ?? "not checked"}`);
  console.log(`Proof digest: ${proof.proofDigest}`);

  const output = option("export");
  if (output) {
    const saved = exportPublicProof(output, proof);
    console.log(`Proof exported: ${saved}`);
  }
  console.log(`\n${JSON.stringify(proof, null, 2)}`);

  if (["ACTIVE_VALID", "ACTIVE_DOCUMENT_NOT_CHECKED", "REVOKED", "CHAIN_NOT_CHECKED"].includes(proof.outcome)) return;
  process.exitCode = 2;
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
