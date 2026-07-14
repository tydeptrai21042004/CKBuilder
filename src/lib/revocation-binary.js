import { AppError } from "./errors.js";
import { sha256Hex } from "./crypto.js";

export const REVOCATION_RECORD_LENGTH = 75;
export const REVOCATION_VERSION = 1;
export const CHAIN_STATUS_ACTIVE = 0;
export const CHAIN_STATUS_REVOKED = 1;

function hex32ToBuffer(value, label) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new AppError("BINARY_FIELD_INVALID", `${label} must be 32 bytes.`);
  return Buffer.from(value.slice(2), "hex");
}

export function credentialHash(credentialId) {
  return sha256Hex(Buffer.from(credentialId, "utf8"));
}

export function encodeRevocationRecord({ status, credentialId, issuerLockHash, reasonCode = 0, revokedAt = 0n }) {
  if (![CHAIN_STATUS_ACTIVE, CHAIN_STATUS_REVOKED].includes(status)) throw new AppError("STATUS_INVALID", "Chain status must be 0 or 1.");
  if (!Number.isInteger(reasonCode) || reasonCode < 0 || reasonCode > 255) throw new AppError("REASON_CODE_INVALID", "reasonCode must fit in one byte.");
  const timestamp = BigInt(revokedAt);
  if (timestamp < 0n || timestamp > 0xffffffffffffffffn) throw new AppError("TIMESTAMP_INVALID", "revokedAt must fit in u64.");

  const buffer = Buffer.alloc(REVOCATION_RECORD_LENGTH);
  buffer.writeUInt8(REVOCATION_VERSION, 0);
  buffer.writeUInt8(status, 1);
  hex32ToBuffer(credentialHash(credentialId), "credential hash").copy(buffer, 2);
  hex32ToBuffer(issuerLockHash, "issuerLockHash").copy(buffer, 34);
  buffer.writeUInt8(reasonCode, 66);
  buffer.writeBigUInt64LE(timestamp, 67);
  return buffer;
}

export function decodeRevocationRecord(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length !== REVOCATION_RECORD_LENGTH) {
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
