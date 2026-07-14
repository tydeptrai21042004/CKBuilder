#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { parseEnvText } from "../lib/env.js";
import { createActiveRecord, deriveIssuer, inspectRecord, revokeRecord } from "../ckb/local-chain.js";

const root = process.cwd();
const envFile = path.join(root, ".env");
if (!fs.existsSync(envFile)) throw new Error(".env is missing.");
const env = { ...parseEnvText(fs.readFileSync(envFile, "utf8")), ...process.env };

function setEnvValue(key, value) {
  const original = fs.readFileSync(envFile, "utf8");
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const updated = pattern.test(original) ? original.replace(pattern, line) : `${original.trimEnd()}\n${line}\n`;
  fs.writeFileSync(envFile, updated);
  env[key] = value;
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const command = process.argv[2];
const credentialId = process.argv[3] ?? process.env.LOCAL_CHAIN_CREDENTIAL_ID ?? "CKB-DEGREE-LOCAL-DEMO";
const statePath = path.resolve(env.OFFCKB_CHAIN_STATE ?? "./data/offckb-chain-state.json");

switch (command) {
  case "configure": {
    const issuer = await deriveIssuer(env);
    setEnvValue("ISSUER_LOCK_HASH", issuer.lockHash);
    setEnvValue("APP_NETWORK", "devnet");
    setEnvValue("REQUIRE_CKB_RPC", "1");
    writeJson(path.resolve("data/offckb-issuer-public.json"), issuer);
    console.log(JSON.stringify(issuer, null, 2));
    break;
  }
  case "create-active": {
    const result = await createActiveRecord(env, credentialId);
    writeJson(statePath, { ...result, createdAt: new Date().toISOString() });
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case "revoke": {
    const reasonCode = Number(process.argv[4] ?? 1);
    const result = await revokeRecord(env, credentialId, reasonCode);
    const previous = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
    writeJson(statePath, { ...previous, revocation: result, updatedAt: new Date().toISOString() });
    console.log(JSON.stringify(result, null, 2));
    break;
  }
  case "verify": {
    const result = await inspectRecord(env, credentialId);
    console.log(JSON.stringify(result, null, 2));
    if (!result.found) process.exitCode = 2;
    break;
  }
  case "lifecycle": {
    const active = await createActiveRecord(env, credentialId);
    const activeCheck = await inspectRecord(env, credentialId);
    if (activeCheck.status !== "ACTIVE") throw new Error("ACTIVE Cell verification failed.");
    const revocation = await revokeRecord(env, credentialId, 1);
    const finalCheck = await inspectRecord(env, credentialId);
    if (finalCheck.status !== "REVOKED") throw new Error("REVOKED Cell verification failed.");
    const state = { credentialId, active, activeCheck, revocation, finalCheck, completedAt: new Date().toISOString() };
    writeJson(statePath, state);
    console.log(JSON.stringify(state, null, 2));
    break;
  }
  default:
    console.error("Usage: node src/cli/offckb-local.js <configure|create-active|revoke|verify|lifecycle> [credentialId] [reasonCode]");
    process.exitCode = 1;
}
