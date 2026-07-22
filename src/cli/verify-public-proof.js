#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { verifyPublicProof } from "../lib/proof-verifier.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run proof:verify -- <verification-proof.json>");
  process.exit(2);
}

try {
  const absolute = path.resolve(file);
  const proof = JSON.parse(fs.readFileSync(absolute, "utf8"));
  const result = verifyPublicProof(proof);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.valid ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ valid: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
