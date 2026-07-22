import assert from "node:assert/strict";
import test from "node:test";
import { summarizeLiveRecords, validateDecodedRecord } from "../src/ckb/record-inspection.js";

const issuer = `0x${"11".repeat(32)}`;
const hash = `0x${"22".repeat(32)}`;

function entry(status, options = {}) {
  const record = {
    version: options.version ?? 1,
    status,
    credentialHash: hash,
    issuerLockHash: options.issuerLockHash ?? issuer,
    reasonCode: options.reasonCode ?? (status === 0 ? 0 : 1),
    revokedAt: options.revokedAt ?? (status === 0 ? 0n : 10n)
  };
  return {
    outPoint: { txHash: `0x${"33".repeat(32)}`, index: 0 },
    record,
    errors: validateDecodedRecord(record, issuer)
  };
}

test("record summary distinguishes active, revoked, invalid and duplicate states", () => {
  assert.equal(summarizeLiveRecords([]).status, "NOT_FOUND");
  assert.equal(summarizeLiveRecords([entry(0)]).status, "ACTIVE");
  assert.equal(summarizeLiveRecords([entry(1)]).status, "REVOKED");
  assert.equal(summarizeLiveRecords([entry(0, { version: 9 })]).status, "INVALID_RECORD");
  assert.equal(summarizeLiveRecords([entry(0), entry(1)]).status, "CONFLICT_DUPLICATE");
  assert.equal(summarizeLiveRecords([entry(0), entry(0)]).status, "CONFLICT_DUPLICATE");
});

test("record validator enforces state-specific fields and issuer binding", () => {
  assert.deepEqual(validateDecodedRecord(entry(0).record, issuer), []);
  assert.equal(validateDecodedRecord(entry(0, { reasonCode: 1 }).record, issuer).includes("ACTIVE_FIELDS_INVALID"), true);
  assert.equal(validateDecodedRecord(entry(1, { revokedAt: 0n }).record, issuer).includes("REVOKED_FIELDS_INVALID"), true);
  assert.equal(
    validateDecodedRecord(entry(0, { issuerLockHash: `0x${"44".repeat(32)}` }).record, issuer).includes("ISSUER_LOCK_HASH_MISMATCH"),
    true
  );
  assert.equal(
    validateDecodedRecord(entry(0).record, issuer, `0x${"55".repeat(32)}`).includes("CREDENTIAL_HASH_MISMATCH"),
    true
  );
});
