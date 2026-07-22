import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAIN_STATUS_ACTIVE,
  CHAIN_STATUS_REVOKED,
  credentialHash,
  decodeRevocationRecord,
  decodeRevocationRecordJson,
  encodeRevocationRecord,
  encodeRevocationRecordFromHash,
  reasonCodeName,
  validateRevocationRecord
} from "../src/lib/revocation-binary.js";

const credentialId = "VECTOR-001";
const issuerLockHash = `0x${"11".repeat(32)}`;

test("credential hash is deterministic and trims surrounding whitespace", () => {
  assert.equal(credentialHash(` ${credentialId} `), credentialHash(credentialId));
  assert.match(credentialHash(credentialId), /^0x[0-9a-f]{64}$/);
});

test("active record round-trips through Buffer and hex", () => {
  const encoded = encodeRevocationRecord({ status: CHAIN_STATUS_ACTIVE, credentialId, issuerLockHash });
  assert.equal(encoded.length, 75);
  const fromBuffer = decodeRevocationRecord(encoded);
  const fromHex = decodeRevocationRecord(`0x${encoded.toString("hex")}`);
  assert.deepEqual(fromBuffer, fromHex);
  assert.deepEqual(validateRevocationRecord(fromBuffer), []);
});

test("revoked record exposes reason name and ISO timestamp", () => {
  const encoded = encodeRevocationRecord({
    status: CHAIN_STATUS_REVOKED,
    credentialId,
    issuerLockHash,
    reasonCode: 2,
    revokedAt: 1_752_451_200n
  });
  const decoded = decodeRevocationRecordJson(encoded);
  assert.equal(decoded.canonical, true);
  assert.equal(decoded.statusName, "REVOKED");
  assert.equal(decoded.reasonName, "CREDENTIAL_REPLACED");
  assert.equal(decoded.revokedAtIso, "2025-07-14T00:00:00.000Z");
});

test("hash-based encoder matches credential-ID encoder", () => {
  const a = encodeRevocationRecord({ status: 0, credentialId, issuerLockHash });
  const b = encodeRevocationRecordFromHash({ status: 0, credentialHash: credentialHash(credentialId), issuerLockHash });
  assert.deepEqual(a, b);
});

test("validator reports expected credential and issuer mismatches", () => {
  const record = decodeRevocationRecord(encodeRevocationRecord({ status: 0, credentialId, issuerLockHash }));
  const errors = validateRevocationRecord(record, {
    expectedCredentialHash: `0x${"22".repeat(32)}`,
    expectedIssuerLockHash: `0x${"33".repeat(32)}`
  });
  assert.deepEqual(errors, ["CREDENTIAL_HASH_MISMATCH", "ISSUER_LOCK_HASH_MISMATCH"]);
});

test("validator rejects non-canonical state fields", () => {
  const active = decodeRevocationRecord(encodeRevocationRecord({ status: 0, credentialId, issuerLockHash }));
  active.reasonCode = 1;
  active.revokedAt = 1n;
  assert.equal(validateRevocationRecord(active).includes("ACTIVE_FIELDS_INVALID"), true);

  const revoked = decodeRevocationRecord(encodeRevocationRecord({ status: 1, credentialId, issuerLockHash, reasonCode: 1, revokedAt: 1n }));
  revoked.reasonCode = 0;
  revoked.revokedAt = 0n;
  assert.equal(validateRevocationRecord(revoked).includes("REVOKED_FIELDS_INVALID"), true);
});

test("decoder rejects malformed hex and incorrect length", () => {
  assert.throws(() => decodeRevocationRecord("not-hex"), /0x-prefixed/);
  assert.throws(() => decodeRevocationRecord("0x00"), /exactly 75 bytes/);
  assert.throws(() => decodeRevocationRecord("0x0"), /even-length/);
});

test("encoder rejects invalid status, hash, reason and timestamp", () => {
  assert.throws(() => encodeRevocationRecord({ status: 9, credentialId, issuerLockHash }), /status/i);
  assert.throws(() => encodeRevocationRecordFromHash({ status: 0, credentialHash: "0x12", issuerLockHash }), /credentialHash/);
  assert.throws(() => encodeRevocationRecord({ status: 1, credentialId, issuerLockHash, reasonCode: 256, revokedAt: 1n }), /reasonCode/);
  assert.throws(() => encodeRevocationRecord({ status: 1, credentialId, issuerLockHash, reasonCode: 1, revokedAt: -1n }), /u64/);
});

test("reason registry distinguishes standard and extension codes", () => {
  assert.equal(reasonCodeName(0), "NONE");
  assert.equal(reasonCodeName(1), "ADMINISTRATIVE_CORRECTION");
  assert.equal(reasonCodeName(200), "UNREGISTERED");
});
