/**
 * Dependency-free reference decoder for CKB Degree Proof credential Cell data.
 * This file is intentionally standalone so explorer and visualization projects
 * can copy or adapt it without importing the application.
 */
export const CKB_DEGREE_RECORD_BYTES = 75;

export function decodeCkbDegreeCellData(hex) {
  if (typeof hex !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(hex)) {
    throw new Error("Cell data must be 0x-prefixed, even-length hexadecimal.");
  }
  const bytes = Uint8Array.from(hex.slice(2).match(/.{2}/g)?.map((pair) => Number.parseInt(pair, 16)) ?? []);
  if (bytes.length !== CKB_DEGREE_RECORD_BYTES) throw new Error(`Expected ${CKB_DEGREE_RECORD_BYTES} bytes.`);

  const littleEndianU64 = bytes.slice(67, 75).reduce((value, byte, index) => value | (BigInt(byte) << BigInt(index * 8)), 0n);
  const asHex = (start, end) => `0x${Array.from(bytes.slice(start, end), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const status = bytes[1];
  const reasonCode = bytes[66];
  const errors = [];
  if (bytes[0] !== 1) errors.push("UNSUPPORTED_VERSION");
  if (status !== 0 && status !== 1) errors.push("INVALID_STATUS");
  if (status === 0 && (reasonCode !== 0 || littleEndianU64 !== 0n)) errors.push("ACTIVE_FIELDS_INVALID");
  if (status === 1 && (reasonCode === 0 || littleEndianU64 === 0n)) errors.push("REVOKED_FIELDS_INVALID");

  return {
    protocol: "ckb-degree-credential-cell/v1",
    byteLength: bytes.length,
    version: bytes[0],
    status,
    statusName: status === 0 ? "ACTIVE" : status === 1 ? "REVOKED" : "UNKNOWN",
    credentialHash: asHex(2, 34),
    issuerLockHash: asHex(34, 66),
    reasonCode,
    revokedAt: littleEndianU64.toString(),
    canonical: errors.length === 0,
    errors
  };
}
