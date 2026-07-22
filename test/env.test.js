import assert from "node:assert/strict";
import test from "node:test";
import { parseEnvText, validateEnv } from "../src/lib/env.js";

test("environment parser handles comments and quoted values", () => {
  assert.deepEqual(parseEnvText('# x\nA=1\nB="hello world"\n'), { A: "1", B: "hello world" });
});

test("environment validator rejects missing and malformed lock hash", () => {
  assert.throws(() => validateEnv({}), (error) => error.code === "ENV_VALUES_MISSING");
  const env = {
    APP_NETWORK: "local",
    CKB_RPC_URL: "http://127.0.0.1:28114",
    ISSUER_NAME: "University",
    ISSUER_LOCK_HASH: "0x1234",
    DATA_DIR: "./data",
    ISSUER_PRIVATE_KEY_PATH: "./private.pem",
    ISSUER_PUBLIC_KEY_PATH: "./public.pem",
    TRUSTED_ISSUERS_FILE: "./trusted.json",
    REVOCATION_CONTRACT_BIN: "./contract",
    CKB_ISSUER_PRIVATE_KEY_FILE: "./ckb-private-key",
    OFFCKB_SYSTEM_SCRIPTS: "./system-scripts.json",
    OFFCKB_DEPLOYMENT_SCRIPTS: "./scripts.json",
    OFFCKB_CHAIN_STATE: "./chain-state.json",
    REQUIRE_CKB_RPC: "0"
  };
  assert.throws(() => validateEnv(env), (error) => error.code === "ENV_LOCK_HASH_INVALID");
});

test("public inspector environment does not require private-key settings", async () => {
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const { loadPublicInspectorEnv } = await import("../src/lib/env.js");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ckb-public-env-"));
  fs.writeFileSync(path.join(root, ".env"), [
    "APP_NETWORK=devnet",
    "CKB_RPC_URL=http://127.0.0.1:28114",
    `ISSUER_LOCK_HASH=0x${"11".repeat(32)}`,
    "DATA_DIR=./data",
    "TRUSTED_ISSUERS_FILE=./data/trusted.json",
    "OFFCKB_SYSTEM_SCRIPTS=./deployment/system.json",
    "OFFCKB_DEPLOYMENT_SCRIPTS=./deployment/scripts.json",
    "OFFCKB_CHAIN_STATE=./data/state.json",
    "REQUIRE_CKB_RPC=0",
    "ISSUER_PRIVATE_KEY_PATH=./secrets/private.pem",
    "CKB_ISSUER_PRIVATE_KEY_FILE=./secrets/ckb-key"
  ].join("\n"));
  const env = loadPublicInspectorEnv(root);
  assert.equal("ISSUER_PRIVATE_KEY_PATH" in env, false);
  assert.equal("CKB_ISSUER_PRIVATE_KEY_FILE" in env, false);
  assert.equal(env.APP_NETWORK, "devnet");
});
