import { AppError } from "./errors.js";
import { sha256Hex } from "./crypto.js";

export const REVOCATION_RECORD_LENGTH = 75;
export const REVOCATION_VERSION = 1;
export const CHAIN_STATUS_ACTIVE = 0;
export const CHAIN_STATUS_REVOKED = 1;

export const REVOCATION_REASON_CODES = Object.freeze({
  1: "ADMINISTRATIVE_CORRECTION",
  2: "CREDENTIAL_REPLACED",
  3: "ISSUED_IN_ERROR",
  4: "ACADEMIC_MISCONDUCT",
  5: "LEGAL_OR_POLICY_REQUIREMENT",
  255: "OTHER"
});

function hex32ToBuffer(value, label) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new AppError("BINARY_FIELD_INVALID", `${label} must be 0x followed by exactly 64 hexadecimal characters.`);
  }
  return Buffer.from(value.slice(2), "hex");
}

function normalizeHexData(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (typeof value !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) {
    throw new AppError("REVOCATION_HEX_INVALID", "Cell data must be a 0x-prefixed, even-length hexadecimal string.");
  }
  return Buffer.from(value.slice(2), "hex");
}

export function credentialHash(credentialId) {
  if (typeof credentialId !== "string" || credentialId.trim() === "") {
    throw new AppError("CREDENTIAL_ID_INVALID", "credentialId must be a non-empty string.");
  }
  return sha256Hex(Buffer.from(credentialId.trim(), "utf8"));
}

export function reasonCodeName(reasonCode) {
  return reasonCode === 0 ? "NONE" : REVOCATION_REASON_CODES[reasonCode] ?? "UNREGISTERED";
}

export function chainStatusName(status) {
  if (status === CHAIN_STATUS_ACTIVE) return "ACTIVE";
  if (status === CHAIN_STATUS_REVOKED) return "REVOKED";
  return "UNKNOWN";
}

export function encodeRevocationRecordFromHash({
  status,
  credentialHash: credentialHashHex,
  issuerLockHash,
  reasonCode = 0,
  revokedAt = 0n
}) {
  if (![CHAIN_STATUS_ACTIVE, CHAIN_STATUS_REVOKED].includes(status)) {
    throw new AppError("STATUS_INVALID", "Chain status must be 0 (ACTIVE) or 1 (REVOKED).");
  }
  if (!Number.isInteger(reasonCode) || reasonCode < 0 || reasonCode > 255) {
    throw new AppError("REASON_CODE_INVALID", "reasonCode must fit in one byte.");
  }

  let timestamp;
  try {
    timestamp = BigInt(revokedAt);
  } catch {
    throw new AppError("TIMESTAMP_INVALID", "revokedAt must be convertible to an unsigned 64-bit integer.");
  }
  if (timestamp < 0n || timestamp > 0xffffffffffffffffn) {
    throw new AppError("TIMESTAMP_INVALID", "revokedAt must fit in u64.");
  }

  const buffer = Buffer.alloc(REVOCATION_RECORD_LENGTH);
  buffer.writeUInt8(REVOCATION_VERSION, 0);
  buffer.writeUInt8(status, 1);
  hex32ToBuffer(credentialHashHex, "credentialHash").copy(buffer, 2);
  hex32ToBuffer(issuerLockHash, "issuerLockHash").copy(buffer, 34);
  buffer.writeUInt8(reasonCode, 66);
  buffer.writeBigUInt64LE(timestamp, 67);
  return buffer;
}

export function encodeRevocationRecord({ status, credentialId, issuerLockHash, reasonCode = 0, revokedAt = 0n }) {
  return encodeRevocationRecordFromHash({
    status,
    credentialHash: credentialHash(credentialId),
    issuerLockHash,
    reasonCode,
    revokedAt
  });
}

export function decodeRevocationRecord(value) {
  const buffer = normalizeHexData(value);
  if (buffer.length !== REVOCATION_RECORD_LENGTH) {
    throw new AppError("REVOCATION_DATA_LENGTH_INVALID", `Revocation data must be exactly ${REVOCATION_RECORD_LENGTH} bytes.`);
  }
  return {
    version: buffer.readUInt8(0),
    status: buffer.readUInt8(1),
    credentialHash: `0x${buffer.subarray(2, 34).toString("hex")}`,
    issuerLockHash: `0x${buffer.subarray(34, 66).toString("hex")}`,
    reasonCode: buffer.readUInt8(66),
    revokedAt: buffer.readBigUInt64LE(67)
  };
}

export function validateRevocationRecord(record, options = {}) {
  const errors = [];
  if (!record || typeof record !== "object") return ["RECORD_INVALID"];
  if (record.version !== REVOCATION_VERSION) errors.push("UNSUPPORTED_VERSION");
  if (![CHAIN_STATUS_ACTIVE, CHAIN_STATUS_REVOKED].includes(record.status)) errors.push("INVALID_STATUS");
  if (!/^0x[0-9a-fA-F]{64}$/.test(record.credentialHash ?? "")) errors.push("CREDENTIAL_HASH_INVALID");
  if (!/^0x[0-9a-fA-F]{64}$/.test(record.issuerLockHash ?? "")) errors.push("ISSUER_LOCK_HASH_INVALID");
  if (options.expectedCredentialHash && record.credentialHash?.toLowerCase() !== options.expectedCredentialHash.toLowerCase()) {
    errors.push("CREDENTIAL_HASH_MISMATCH");
  }
  if (options.expectedIssuerLockHash && record.issuerLockHash?.toLowerCase() !== options.expectedIssuerLockHash.toLowerCase()) {
    errors.push("ISSUER_LOCK_HASH_MISMATCH");
  }
  if (!Number.isInteger(record.reasonCode) || record.reasonCode < 0 || record.reasonCode > 255) {
    errors.push("REASON_CODE_INVALID");
  }
  if (typeof record.revokedAt !== "bigint" || record.revokedAt < 0n || record.revokedAt > 0xffffffffffffffffn) {
    errors.push("TIMESTAMP_INVALID");
  }
  if (record.status === CHAIN_STATUS_ACTIVE && (record.reasonCode !== 0 || record.revokedAt !== 0n)) {
    errors.push("ACTIVE_FIELDS_INVALID");
  }
  if (record.status === CHAIN_STATUS_REVOKED && (record.reasonCode === 0 || record.revokedAt === 0n)) {
    errors.push("REVOKED_FIELDS_INVALID");
  }
  return [...new Set(errors)];
}

export function revocationRecordToJson(record, options = {}) {
  const errors = validateRevocationRecord(record, options);
  const revokedAt = typeof record.revokedAt === "bigint" ? record.revokedAt : 0n;
  let revokedAtIso = null;
  if (revokedAt > 0n && revokedAt <= BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 1000))) {
    const date = new Date(Number(revokedAt) * 1000);
    if (Number.isFinite(date.getTime())) revokedAtIso = date.toISOString();
  }
  return {
    version: record.version,
    status: record.status,
    statusName: chainStatusName(record.status),
    credentialHash: record.credentialHash,
    issuerLockHash: record.issuerLockHash,
    reasonCode: record.reasonCode,
    reasonName: reasonCodeName(record.reasonCode),
    revokedAt: revokedAt.toString(),
    revokedAtIso,
    canonical: errors.length === 0,
    errors
  };
}

export function decodeRevocationRecordJson(value, options = {}) {
  return revocationRecordToJson(decodeRevocationRecord(value), options);
}
