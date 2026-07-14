import crypto from "node:crypto";
import fs from "node:fs";
import { canonicalJson, ensureParent } from "./json.js";
import { AppError } from "./errors.js";

export function sha256Hex(data) {
  return `0x${crypto.createHash("sha256").update(data).digest("hex")}`;
}

export function hashFile(filePath) {
  if (!fs.existsSync(filePath)) throw new AppError("FILE_NOT_FOUND", `File not found: ${filePath}`);
  return sha256Hex(fs.readFileSync(filePath));
}

export function generateIssuerKeys(privatePath, publicPath) {
  ensureParent(privatePath);
  ensureParent(publicPath);
  if (fs.existsSync(privatePath) || fs.existsSync(publicPath)) {
    if (!(fs.existsSync(privatePath) && fs.existsSync(publicPath))) {
      throw new AppError("KEYPAIR_INCOMPLETE", "Only one issuer key file exists. Remove the partial key and initialize again.");
    }
    return { created: false };
  }

  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  fs.writeFileSync(privatePath, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey.export({ type: "spki", format: "pem" }), { mode: 0o644 });
  return { created: true };
}

export function loadPrivateKey(filePath) {
  if (!fs.existsSync(filePath)) throw new AppError("PRIVATE_KEY_MISSING", `Issuer private key is missing: ${filePath}`);
  return crypto.createPrivateKey(fs.readFileSync(filePath));
}

export function loadPublicKey(filePath) {
  if (!fs.existsSync(filePath)) throw new AppError("PUBLIC_KEY_MISSING", `Issuer public key is missing: ${filePath}`);
  return crypto.createPublicKey(fs.readFileSync(filePath));
}

export function publicKeyPem(publicKey) {
  return publicKey.export({ type: "spki", format: "pem" }).toString();
}

export function issuerIdFromPublicKey(publicKey) {
  const der = publicKey.export({ type: "spki", format: "der" });
  return sha256Hex(der);
}

export function signObject(value, privateKey) {
  return crypto.sign(null, Buffer.from(canonicalJson(value)), privateKey).toString("base64");
}

export function verifyObject(value, signatureBase64, publicKey) {
  try {
    return crypto.verify(
      null,
      Buffer.from(canonicalJson(value)),
      publicKey,
      Buffer.from(signatureBase64, "base64")
    );
  } catch {
    return false;
  }
}

export function identityCommitment(studentId, salt) {
  if (!studentId || !salt) throw new AppError("IDENTITY_INPUT_MISSING", "studentId and identitySalt are required for the private mint input.");
  return sha256Hex(Buffer.from(`${studentId}\u0000${salt}`, "utf8"));
}
