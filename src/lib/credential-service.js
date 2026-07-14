import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "./errors.js";
import {
  generateIssuerKeys,
  hashFile,
  identityCommitment,
  issuerIdFromPublicKey,
  loadPrivateKey,
  loadPublicKey,
  publicKeyPem,
  signObject,
  verifyObject
} from "./crypto.js";
import { loadLedger, saveLedger } from "./ledger.js";
import { readJson, writeJsonAtomic } from "./json.js";
import {
  CREDENTIAL_SCHEMA,
  RECORD_SCHEMA,
  STATUS_ACTIVE,
  STATUS_REVOKED,
  validateCredentialPayload,
  validateMintInput
} from "./schema.js";
import {
  CHAIN_STATUS_ACTIVE,
  CHAIN_STATUS_REVOKED,
  encodeRevocationRecord
} from "./revocation-binary.js";

export function initializeIssuer(env) {
  const result = generateIssuerKeys(env.ISSUER_PRIVATE_KEY_PATH, env.ISSUER_PUBLIC_KEY_PATH);
  const publicKey = loadPublicKey(env.ISSUER_PUBLIC_KEY_PATH);
  const issuerId = issuerIdFromPublicKey(publicKey);
  const trusted = readJson(env.TRUSTED_ISSUERS_FILE, { schema: "ckb-degree-proof-trusted-issuers/v1", issuers: {} });
  trusted.issuers[issuerId] = {
    name: env.ISSUER_NAME,
    publicKeyPem: publicKeyPem(publicKey),
    lockHash: env.ISSUER_LOCK_HASH
  };
  writeJsonAtomic(env.TRUSTED_ISSUERS_FILE, trusted);
  return { ...result, issuerId };
}

export function mintCredential(env, input, documentPath, options = {}) {
  validateMintInput(input);
  const privateKey = loadPrivateKey(env.ISSUER_PRIVATE_KEY_PATH);
  const publicKey = loadPublicKey(env.ISSUER_PUBLIC_KEY_PATH);
  const issuerId = issuerIdFromPublicKey(publicKey);
  const ledger = loadLedger(env.DATA_DIR);
  if (ledger.credentials[input.credentialId]) {
    throw new AppError("CREDENTIAL_ALREADY_EXISTS", `Credential already exists: ${input.credentialId}`);
  }

  const payload = {
    schema: CREDENTIAL_SCHEMA,
    credentialId: input.credentialId,
    issuer: {
      issuerId,
      name: env.ISSUER_NAME,
      lockHash: env.ISSUER_LOCK_HASH
    },
    subject: {
      recipientLockHash: input.recipientLockHash.toLowerCase(),
      identityCommitment: identityCommitment(input.studentId, input.identitySalt)
    },
    award: {
      title: input.degreeTitle,
      field: input.fieldOfStudy,
      classification: input.classification ?? null,
      issuedAt: input.issuedAt
    },
    document: {
      hashAlgorithm: "sha256",
      hash: hashFile(documentPath),
      fileName: path.basename(documentPath)
    },
    createdAt: options.createdAt ?? new Date().toISOString()
  };
  validateCredentialPayload(payload);
  const signature = signObject(payload, privateKey);
  const record = {
    schema: RECORD_SCHEMA,
    status: STATUS_ACTIVE,
    payload,
    issuerPublicKeyPem: publicKeyPem(publicKey),
    signature,
    revocation: null
  };

  ledger.credentials[input.credentialId] = record;
  saveLedger(env.DATA_DIR, ledger);

  const credentialDir = path.join(env.DATA_DIR, "credentials");
  fs.mkdirSync(credentialDir, { recursive: true });
  writeJsonAtomic(path.join(credentialDir, `${safeName(input.credentialId)}.json`), record);

  const chainDir = path.join(env.DATA_DIR, "revocations");
  fs.mkdirSync(chainDir, { recursive: true });
  fs.writeFileSync(
    path.join(chainDir, `${safeName(input.credentialId)}-active.bin`),
    encodeRevocationRecord({
      status: CHAIN_STATUS_ACTIVE,
      credentialId: input.credentialId,
      issuerLockHash: env.ISSUER_LOCK_HASH,
      reasonCode: 0,
      revokedAt: 0n
    })
  );

  return record;
}

export function revokeCredential(env, credentialId, reasonCode, reasonText, options = {}) {
  const ledger = loadLedger(env.DATA_DIR);
  const record = ledger.credentials[credentialId];
  if (!record) throw new AppError("CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
  if (record.status === STATUS_REVOKED || ledger.revocations[credentialId] || record.revocation) {
    throw new AppError("CREDENTIAL_ALREADY_REVOKED", `Credential is already revoked: ${credentialId}`);
  }
  if (!Number.isInteger(reasonCode) || reasonCode < 1 || reasonCode > 255) {
    throw new AppError("REASON_CODE_INVALID", "Revocation reasonCode must be between 1 and 255.");
  }
  if (typeof reasonText !== "string" || reasonText.trim() === "") {
    throw new AppError("REVOCATION_REASON_MISSING", "A human-readable revocation reason is required.");
  }

  const privateKey = loadPrivateKey(env.ISSUER_PRIVATE_KEY_PATH);
  const publicKey = loadPublicKey(env.ISSUER_PUBLIC_KEY_PATH);
  const issuerId = issuerIdFromPublicKey(publicKey);
  if (issuerId !== record.payload.issuer.issuerId) {
    throw new AppError("ISSUER_MISMATCH", "The configured issuer is not authorized to revoke this credential.");
  }

  const revokedAtIso = options.revokedAt ?? new Date().toISOString();
  const event = {
    schema: "ckb-degree-revocation/v1",
    credentialId,
    issuerId,
    reasonCode,
    reason: reasonText,
    revokedAt: revokedAtIso
  };
  const signature = signObject(event, privateKey);
  record.status = STATUS_REVOKED;
  record.revocation = { event, signature };
  ledger.revocations[credentialId] = record.revocation;
  saveLedger(env.DATA_DIR, ledger);

  const unixSeconds = BigInt(Math.floor(new Date(revokedAtIso).getTime() / 1000));
  const chainDir = path.join(env.DATA_DIR, "revocations");
  fs.mkdirSync(chainDir, { recursive: true });
  fs.writeFileSync(
    path.join(chainDir, `${safeName(credentialId)}-revoked.bin`),
    encodeRevocationRecord({
      status: CHAIN_STATUS_REVOKED,
      credentialId,
      issuerLockHash: env.ISSUER_LOCK_HASH,
      reasonCode,
      revokedAt: unixSeconds
    })
  );
  return record.revocation;
}

export function verifyCredential(env, credentialId, documentPath, options = {}) {
  const checks = [];
  const fail = (name, code, message) => checks.push({ name, ok: false, code, message });
  const pass = (name, message) => checks.push({ name, ok: true, message });

  const ledger = loadLedger(env.DATA_DIR);
  const record = ledger.credentials[credentialId];
  if (!record) {
    fail("credential_exists", "CREDENTIAL_NOT_FOUND", `Credential not found: ${credentialId}`);
    return result(false, checks, null);
  }
  pass("credential_exists", "Credential record exists.");

  try {
    validateCredentialPayload(record.payload);
    pass("schema", "Credential schema and field encodings are valid.");
  } catch (error) {
    fail("schema", error.code ?? "SCHEMA_INVALID", error.message);
  }

  const trusted = readJson(env.TRUSTED_ISSUERS_FILE, { issuers: {} });
  const trustedIssuer = trusted.issuers?.[record.payload.issuer.issuerId];
  if (!trustedIssuer) {
    fail("trusted_issuer", "UNTRUSTED_ISSUER", "Issuer is not present in the trusted issuer registry.");
  } else if (trustedIssuer.lockHash.toLowerCase() !== record.payload.issuer.lockHash.toLowerCase()) {
    fail("trusted_issuer", "ISSUER_LOCK_HASH_MISMATCH", "Issuer lock hash differs from the trusted registry.");
  } else {
    pass("trusted_issuer", "Issuer ID and lock hash are trusted.");
  }

  try {
    const recordPublicKey = crypto.createPublicKey(record.issuerPublicKeyPem);
    const keyId = issuerIdFromPublicKey(recordPublicKey);
    if (keyId !== record.payload.issuer.issuerId) {
      fail("issuer_key", "ISSUER_KEY_ID_MISMATCH", "Embedded issuer public key does not match issuerId.");
    } else if (!verifyObject(record.payload, record.signature, recordPublicKey)) {
      fail("credential_signature", "SIGNATURE_INVALID", "Credential signature is invalid or the payload was modified.");
    } else {
      pass("issuer_key", "Issuer public key matches issuerId.");
      pass("credential_signature", "Credential signature is valid.");
    }
  } catch {
    fail("credential_signature", "SIGNATURE_INVALID", "Credential signature or public key could not be verified.");
  }

  try {
    const actualHash = hashFile(documentPath);
    if (actualHash !== record.payload.document.hash) {
      fail("document_hash", "DOCUMENT_HASH_MISMATCH", "Uploaded document differs from the document used during minting.");
    } else {
      pass("document_hash", "Uploaded document hash matches the credential.");
    }
  } catch (error) {
    fail("document_hash", error.code ?? "DOCUMENT_READ_FAILED", error.message);
  }

  if (options.recipientLockHash) {
    if (options.recipientLockHash.toLowerCase() !== record.payload.subject.recipientLockHash.toLowerCase()) {
      fail("recipient_binding", "RECIPIENT_MISMATCH", "The supplied recipient lock hash does not match the credential.");
    } else {
      pass("recipient_binding", "Recipient lock hash matches.");
    }
  }

  if (options.studentId || options.identitySalt) {
    try {
      const commitment = identityCommitment(options.studentId, options.identitySalt);
      if (commitment !== record.payload.subject.identityCommitment) {
        fail("identity_commitment", "IDENTITY_COMMITMENT_MISMATCH", "Student identity commitment does not match.");
      } else {
        pass("identity_commitment", "Private student identity commitment matches.");
      }
    } catch (error) {
      fail("identity_commitment", error.code ?? "IDENTITY_INPUT_INVALID", error.message);
    }
  }

  const revocationRecord = ledger.revocations[credentialId] ?? record.revocation;
  if (record.status === STATUS_REVOKED || revocationRecord) {
    let revocationValid = false;
    try {
      const publicKey = crypto.createPublicKey(record.issuerPublicKeyPem);
      revocationValid = Boolean(revocationRecord?.event) && verifyObject(revocationRecord.event, revocationRecord.signature, publicKey);
    } catch {
      revocationValid = false;
    }
    if (!revocationValid) {
      fail("revocation_signature", "REVOCATION_SIGNATURE_INVALID", "Revocation record is malformed or unsigned.");
    } else {
      pass("revocation_signature", "Revocation event signature is valid.");
      if (record.status === STATUS_ACTIVE) {
        fail("revocation_status", "REACTIVATION_DETECTED", "A signed revocation exists but the record was changed back to ACTIVE.");
      } else {
        fail("revocation_status", "CREDENTIAL_REVOKED", `Credential was revoked: ${revocationRecord.event.reason}`);
      }
    }
  } else if (record.status === STATUS_ACTIVE) {
    pass("revocation_status", "Credential is active.");
  } else {
    fail("revocation_status", "STATUS_INVALID", `Unknown credential status: ${record.status}`);
  }

  return result(checks.every((check) => check.ok), checks, record);
}

function result(valid, checks, record) {
  return { valid, checks, credential: record?.payload ?? null, status: record?.status ?? null };
}

function safeName(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}
