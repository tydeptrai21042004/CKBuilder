import fs from "node:fs";
import path from "node:path";
import { AppError } from "./errors.js";

const REQUIRED_KEYS = [
  "APP_NETWORK",
  "CKB_RPC_URL",
  "ISSUER_NAME",
  "ISSUER_LOCK_HASH",
  "DATA_DIR",
  "ISSUER_PRIVATE_KEY_PATH",
  "ISSUER_PUBLIC_KEY_PATH",
  "TRUSTED_ISSUERS_FILE",
  "REVOCATION_CONTRACT_BIN",
  "CKB_ISSUER_PRIVATE_KEY_FILE",
  "OFFCKB_SYSTEM_SCRIPTS",
  "OFFCKB_DEPLOYMENT_SCRIPTS",
  "OFFCKB_CHAIN_STATE"
];

export function parseEnvText(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function loadEnv(rootDir = process.cwd(), options = {}) {
  const envPath = path.join(rootDir, options.filename ?? ".env");
  if (!fs.existsSync(envPath)) {
    throw new AppError("ENV_FILE_MISSING", `Missing ${envPath}. Copy .env.example to .env first.`);
  }
  const fileValues = parseEnvText(fs.readFileSync(envPath, "utf8"));
  const merged = { ...fileValues, ...process.env };
  validateEnv(merged);
  return resolveEnvPaths(merged, rootDir);
}

export function validateEnv(env) {
  const missing = REQUIRED_KEYS.filter((key) => typeof env[key] !== "string" || env[key].trim() === "");
  if (missing.length > 0) {
    throw new AppError("ENV_VALUES_MISSING", "Required environment values are missing.", { missing });
  }

  if (!new Set(["local", "devnet", "testnet"]).has(env.APP_NETWORK)) {
    throw new AppError("ENV_NETWORK_INVALID", "APP_NETWORK must be local, devnet, or testnet.");
  }

  try {
    const rpc = new URL(env.CKB_RPC_URL);
    if (!new Set(["http:", "https:"]).has(rpc.protocol)) throw new Error("invalid protocol");
  } catch {
    throw new AppError("ENV_RPC_INVALID", "CKB_RPC_URL must be a valid HTTP or HTTPS URL.");
  }

  if (!/^0x[0-9a-fA-F]{64}$/.test(env.ISSUER_LOCK_HASH)) {
    throw new AppError("ENV_LOCK_HASH_INVALID", "ISSUER_LOCK_HASH must be 0x followed by exactly 64 hexadecimal characters.");
  }

  if (!["0", "1"].includes(String(env.REQUIRE_CKB_RPC ?? "0"))) {
    throw new AppError("ENV_RPC_FLAG_INVALID", "REQUIRE_CKB_RPC must be 0 or 1.");
  }
}

function resolveEnvPaths(env, rootDir) {
  const resolve = (value) => path.resolve(rootDir, value);
  return {
    ...env,
    ROOT_DIR: rootDir,
    DATA_DIR: resolve(env.DATA_DIR),
    ISSUER_PRIVATE_KEY_PATH: resolve(env.ISSUER_PRIVATE_KEY_PATH),
    ISSUER_PUBLIC_KEY_PATH: resolve(env.ISSUER_PUBLIC_KEY_PATH),
    TRUSTED_ISSUERS_FILE: resolve(env.TRUSTED_ISSUERS_FILE),
    REVOCATION_CONTRACT_BIN: resolve(env.REVOCATION_CONTRACT_BIN),
    CKB_ISSUER_PRIVATE_KEY_FILE: resolve(env.CKB_ISSUER_PRIVATE_KEY_FILE),
    OFFCKB_SYSTEM_SCRIPTS: resolve(env.OFFCKB_SYSTEM_SCRIPTS),
    OFFCKB_DEPLOYMENT_SCRIPTS: resolve(env.OFFCKB_DEPLOYMENT_SCRIPTS),
    OFFCKB_CHAIN_STATE: resolve(env.OFFCKB_CHAIN_STATE),
    REQUIRE_CKB_RPC: String(env.REQUIRE_CKB_RPC ?? "0") === "1"
  };
}
