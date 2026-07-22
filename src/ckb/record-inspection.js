import {
  CHAIN_STATUS_ACTIVE,
  CHAIN_STATUS_REVOKED,
  revocationRecordToJson,
  validateRevocationRecord
} from "../lib/revocation-binary.js";

export function validateDecodedRecord(record, expectedIssuerLockHash, expectedCredentialHash) {
  return validateRevocationRecord(record, {
    expectedIssuerLockHash,
    expectedCredentialHash
  });
}

export function summarizeLiveRecords(matches) {
  const valid = matches.filter((entry) => entry.errors.length === 0);
  const invalid = matches.filter((entry) => entry.errors.length > 0);
  const active = valid.filter((entry) => entry.record.status === CHAIN_STATUS_ACTIVE);
  const revoked = valid.filter((entry) => entry.record.status === CHAIN_STATUS_REVOKED);

  let status = "NOT_FOUND";
  if (matches.length > 1 || (active.length > 0 && revoked.length > 0)) status = "CONFLICT_DUPLICATE";
  else if (invalid.length === 1 && valid.length === 0) status = "INVALID_RECORD";
  else if (active.length === 1) status = "ACTIVE";
  else if (revoked.length === 1) status = "REVOKED";

  const records = matches.map((entry) => ({
    outPoint: entry.outPoint,
    record: revocationRecordToJson(entry.record),
    errors: entry.errors
  }));
  const single = records.length === 1 ? records[0] : undefined;

  return {
    found: matches.length > 0,
    status,
    activeCount: active.length,
    revokedCount: revoked.length,
    invalidCount: invalid.length,
    totalCount: matches.length,
    records,
    ...(single ? { outPoint: single.outPoint, record: single.record } : {})
  };
}
