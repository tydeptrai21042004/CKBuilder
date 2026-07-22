#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { decodeRevocationRecordJson } from "../lib/revocation-binary.js";

function readInput(argument) {
  if (!argument) throw new Error("Provide 0x-prefixed Cell data or a file containing raw bytes/hex.");
  if (argument.startsWith("0x")) return argument;
  const absolute = path.resolve(argument);
  const bytes = fs.readFileSync(absolute);
  const text = bytes.toString("utf8").trim();
  if (/^0x(?:[0-9a-fA-F]{2})+$/.test(text)) return text;
  return bytes;
}

try {
  const value = readInput(process.argv[2]);
  const expectedCredentialHash = process.env.EXPECTED_CREDENTIAL_HASH;
  const expectedIssuerLockHash = process.env.EXPECTED_ISSUER_LOCK_HASH;
  const decoded = decodeRevocationRecordJson(value, { expectedCredentialHash, expectedIssuerLockHash });
  console.log(JSON.stringify(decoded, null, 2));
  process.exitCode = decoded.canonical ? 0 : 1;
} catch (error) {
  console.error(JSON.stringify({ canonical: false, error: error?.code ?? "DECODE_FAILED", message: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
}
