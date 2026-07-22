import fs from "node:fs";

const CONTRACT_NAME = "credential-revocation";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing: ${filePath}`);
  return filePath;
}

/**
 * Convert OffCKB's system-scripts.json to the key shape expected by CCC.
 * String keys are used deliberately so this pure parser can be tested without
 * installing CCC or connecting to a node.
 */
export function buildKnownScripts(systemScriptsPath) {
  const root = readJson(requireFile(systemScriptsPath, "OffCKB system scripts"));
  const scripts = root?.devnet;
  if (!scripts) throw new Error("deployment/system-scripts.json does not contain devnet scripts.");

  const required = {
    Secp256k1Blake160: scripts.secp256k1_blake160_sighash_all?.script,
    NervosDao: scripts.dao?.script
  };
  const optional = {
    Secp256k1Multisig: scripts.secp256k1_blake160_multisig_all?.script,
    AnyoneCanPay: scripts.anyone_can_pay?.script,
    OmniLock: scripts.omnilock?.script,
    XUdt: scripts.xudt?.script,
    TypeId: scripts.type_id?.script ?? {
      codeHash: "0x00000000000000000000000000000000000000000000000000545950455f4944",
      hashType: "type",
      cellDeps: []
    }
  };

  for (const [name, value] of Object.entries(required)) {
    if (!value) throw new Error(`Required devnet known Script is missing: ${name}`);
  }
  return Object.fromEntries(Object.entries({ ...required, ...optional }).filter(([, value]) => value));
}

export function loadContractInfo(deploymentScriptsPath) {
  const root = readJson(requireFile(deploymentScriptsPath, "OffCKB deployment scripts"));
  const entries = root?.devnet ?? {};
  const exact = entries[CONTRACT_NAME];
  if (exact) return exact;
  const found = Object.entries(entries).find(([name]) => name.replace(/\.(bc|bin)$/i, "") === CONTRACT_NAME);
  if (!found) throw new Error(`Cannot find ${CONTRACT_NAME} in ${deploymentScriptsPath}.`);
  return found[1];
}
