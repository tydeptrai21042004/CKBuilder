#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  CHAIN_STATUS_ACTIVE,
  CHAIN_STATUS_REVOKED,
  credentialHash,
  decodeRevocationRecordJson,
  encodeRevocationRecord
} from "../src/lib/revocation-binary.js";

const output = path.resolve(process.argv[2] ?? "community/test-vectors/credential-cell-v1.json");
const issuerLockHash = `0x${"11".repeat(32)}`;
const credentialId = "CKB-DEGREE-COMMUNITY-VECTOR-001";

function vector(name, buffer, valid = true) {
  const hex = `0x${buffer.toString("hex")}`;
  let decoded;
  try {
    decoded = decodeRevocationRecordJson(hex);
  } catch (error) {
    decoded = { canonical: false, error: error?.code ?? "DECODE_FAILED" };
  }
  return { name, valid, cellData: hex, expected: decoded };
}

const active = encodeRevocationRecord({
  status: CHAIN_STATUS_ACTIVE,
  credentialId,
  issuerLockHash
});
const revoked = encodeRevocationRecord({
  status: CHAIN_STATUS_REVOKED,
  credentialId,
  issuerLockHash,
  reasonCode: 2,
  revokedAt: 1_752_451_200n
});
const invalidStatus = Buffer.from(active);
invalidStatus[1] = 9;
const invalidActiveFields = Buffer.from(active);
invalidActiveFields[66] = 1;
invalidActiveFields.writeBigUInt64LE(1n, 67);
const invalidRevokedFields = Buffer.from(revoked);
invalidRevokedFields[66] = 0;
invalidRevokedFields.writeBigUInt64LE(0n, 67);

const corpus = {
  schema: "ckb-degree-cell-test-vectors/v1",
  protocol: "ckb-degree-credential-cell/v1",
  generatedBy: "scripts/generate-test-vectors.js",
  recordLength: 75,
  credentialId,
  credentialHash: credentialHash(credentialId),
  issuerLockHash,
  vectors: [
    vector("active-canonical", active),
    vector("revoked-canonical", revoked),
    vector("invalid-status", invalidStatus, false),
    vector("invalid-active-fields", invalidActiveFields, false),
    vector("invalid-revoked-fields", invalidRevokedFields, false),
    {
      name: "invalid-length",
      valid: false,
      cellData: `0x${active.subarray(0, active.length - 1).toString("hex")}`,
      expected: { canonical: false, error: "REVOCATION_DATA_LENGTH_INVALID" }
    }
  ]
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(corpus, null, 2)}\n`);
console.log(output);
