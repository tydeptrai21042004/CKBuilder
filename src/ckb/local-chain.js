import fs from "node:fs";
import path from "node:path";
import { ccc } from "@ckb-ccc/core";
import {
  CHAIN_STATUS_ACTIVE,
  CHAIN_STATUS_REVOKED,
  credentialHash,
  decodeRevocationRecord,
  encodeRevocationRecord
} from "../lib/revocation-binary.js";

const CONTRACT_NAME = "credential-revocation";

function scriptJson(script) {
  return { codeHash: script.codeHash, hashType: script.hashType, args: script.args };
}

function outPointJson(outPoint) {
  return { txHash: outPoint.txHash, index: Number(outPoint.index) };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readSecret(filePath) {
  const value = fs.readFileSync(filePath, "utf8").trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`Invalid CKB private key in ${filePath}`);
  }
  return value;
}

function requireFile(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing: ${filePath}`);
  return filePath;
}

export function buildKnownScripts(systemScriptsPath) {
  const root = readJson(requireFile(systemScriptsPath, "OffCKB system scripts"));
  const scripts = root?.devnet;
  if (!scripts) throw new Error("deployment/system-scripts.json does not contain devnet scripts.");

  const required = {
    [ccc.KnownScript.Secp256k1Blake160]: scripts.secp256k1_blake160_sighash_all?.script,
    [ccc.KnownScript.NervosDao]: scripts.dao?.script
  };

  const optional = {
    [ccc.KnownScript.Secp256k1Multisig]: scripts.secp256k1_blake160_multisig_all?.script,
    [ccc.KnownScript.AnyoneCanPay]: scripts.anyone_can_pay?.script,
    [ccc.KnownScript.OmniLock]: scripts.omnilock?.script,
    [ccc.KnownScript.XUdt]: scripts.xudt?.script,
    [ccc.KnownScript.TypeId]: scripts.type_id?.script ?? {
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
  if (!found) {
    throw new Error(`Cannot find ${CONTRACT_NAME} in ${deploymentScriptsPath}.`);
  }
  return found[1];
}

export function createDevnetContext(env) {
  const systemScriptsPath = path.resolve(env.OFFCKB_SYSTEM_SCRIPTS);
  const deploymentScriptsPath = path.resolve(env.OFFCKB_DEPLOYMENT_SCRIPTS);
  const privateKeyPath = path.resolve(env.CKB_ISSUER_PRIVATE_KEY_FILE);
  const scripts = buildKnownScripts(systemScriptsPath);
  const client = new ccc.ClientPublicTestnet({ url: env.CKB_RPC_URL, scripts });
  const signer = new ccc.SignerCkbPrivateKey(client, readSecret(privateKeyPath));
  const contract = loadContractInfo(deploymentScriptsPath);
  return { client, signer, contract };
}

export async function deriveIssuer(env) {
  const systemScriptsPath = path.resolve(env.OFFCKB_SYSTEM_SCRIPTS);
  const privateKeyPath = path.resolve(env.CKB_ISSUER_PRIVATE_KEY_FILE);
  const scripts = buildKnownScripts(systemScriptsPath);
  const client = new ccc.ClientPublicTestnet({ url: env.CKB_RPC_URL, scripts });
  const signer = new ccc.SignerCkbPrivateKey(client, readSecret(privateKeyPath));
  const address = await signer.getAddressObjSecp256k1();
  return {
    address: address.toString(),
    lockScript: scriptJson(address.script),
    lockHash: address.script.hash()
  };
}

function contractTypeScript(contract, issuerLockHash) {
  return ccc.Script.from({
    codeHash: contract.codeHash,
    hashType: contract.hashType,
    args: issuerLockHash
  });
}

function contractCellDeps(contract) {
  if (!Array.isArray(contract.cellDeps) || contract.cellDeps.length === 0) {
    throw new Error("The deployment record has no contract Cell dependency.");
  }
  return contract.cellDeps.map((entry) => entry.cellDep ?? entry);
}

async function prepareAndSend({ tx, signer, client }) {
  await tx.completeInputsByCapacity(signer);
  await tx.completeFeeBy(signer, 1000n);
  const txHash = await signer.sendTransaction(tx);
  const confirmed = await client.waitTransaction(txHash);
  if (confirmed.status !== "committed") {
    throw new Error(`Transaction ${txHash} did not commit; status=${confirmed.status}`);
  }
  return txHash;
}

export async function createActiveRecord(env, credentialId) {
  const { client, signer, contract } = createDevnetContext(env);
  const issuer = await signer.getAddressObjSecp256k1();
  const issuerLock = issuer.script;
  const issuerLockHash = issuerLock.hash();
  if (issuerLockHash.toLowerCase() !== env.ISSUER_LOCK_HASH.toLowerCase()) {
    throw new Error("ISSUER_LOCK_HASH does not match the selected OffCKB account.");
  }

  const typeScript = contractTypeScript(contract, issuerLockHash);
  const record = encodeRevocationRecord({
    status: CHAIN_STATUS_ACTIVE,
    credentialId,
    issuerLockHash,
    reasonCode: 0,
    revokedAt: 0n
  });
  const outputData = `0x${record.toString("hex")}`;
  const output = ccc.CellOutput.from({ lock: issuerLock, type: typeScript }, outputData);
  const tx = ccc.Transaction.from({
    cellDeps: contractCellDeps(contract),
    outputs: [output],
    outputsData: [outputData]
  });
  const txHash = await prepareAndSend({ tx, signer, client });
  return {
    credentialId,
    credentialHash: credentialHash(credentialId),
    status: "ACTIVE",
    txHash,
    outPoint: { txHash, index: 0 },
    issuerLockHash,
    typeScript: scriptJson(typeScript)
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findLiveRecord(client, typeScript, credentialId, requiredStatus) {
  const expectedHash = credentialHash(credentialId).toLowerCase();
  for await (const cell of client.findCells({
    script: typeScript,
    scriptType: "type",
    scriptSearchMode: "exact",
    withData: true
  })) {
    try {
      const data = Buffer.from(cell.outputData.slice(2), "hex");
      const record = decodeRevocationRecord(data);
      if (record.credentialHash.toLowerCase() === expectedHash && record.status === requiredStatus) {
        return { cell, record };
      }
    } catch {
      // Ignore malformed unrelated cells; the contract would reject newly created malformed records.
    }
  }
  return undefined;
}

async function waitForLiveRecord(client, typeScript, credentialId, requiredStatus, attempts = 45) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const found = await findLiveRecord(client, typeScript, credentialId, requiredStatus);
    if (found) return found;
    if (attempt < attempts) await sleep(1000);
  }
  return undefined;
}

export async function revokeRecord(env, credentialId, reasonCode = 1) {
  const { client, signer, contract } = createDevnetContext(env);
  const issuer = await signer.getAddressObjSecp256k1();
  const issuerLock = issuer.script;
  const issuerLockHash = issuerLock.hash();
  const typeScript = contractTypeScript(contract, issuerLockHash);
  const active = await waitForLiveRecord(client, typeScript, credentialId, CHAIN_STATUS_ACTIVE);
  if (!active) throw new Error(`No live ACTIVE registry Cell found for ${credentialId}.`);

  const revokedAt = BigInt(Math.floor(Date.now() / 1000));
  const record = encodeRevocationRecord({
    status: CHAIN_STATUS_REVOKED,
    credentialId,
    issuerLockHash,
    reasonCode,
    revokedAt
  });
  const outputData = `0x${record.toString("hex")}`;
  const output = ccc.CellOutput.from(
    { capacity: active.cell.cellOutput.capacity, lock: issuerLock, type: typeScript },
    outputData
  );
  const tx = ccc.Transaction.from({
    cellDeps: contractCellDeps(contract),
    outputs: [output],
    outputsData: [outputData]
  });
  tx.addInput(active.cell);
  const txHash = await prepareAndSend({ tx, signer, client });
  return {
    credentialId,
    status: "REVOKED",
    reasonCode,
    revokedAt: revokedAt.toString(),
    txHash,
    outPoint: { txHash, index: 0 },
    spentActiveOutPoint: outPointJson(active.cell.outPoint)
  };
}

export async function inspectRecord(env, credentialId) {
  const { client, signer, contract } = createDevnetContext(env);
  const issuer = await signer.getAddressObjSecp256k1();
  const typeScript = contractTypeScript(contract, issuer.script.hash());
  const revoked = await waitForLiveRecord(client, typeScript, credentialId, CHAIN_STATUS_REVOKED, 20);
  if (revoked) {
    return {
      found: true,
      status: "REVOKED",
      outPoint: outPointJson(revoked.cell.outPoint),
      record: { ...revoked.record, revokedAt: revoked.record.revokedAt.toString() }
    };
  }
  const active = await waitForLiveRecord(client, typeScript, credentialId, CHAIN_STATUS_ACTIVE);
  if (active) {
    return {
      found: true,
      status: "ACTIVE",
      outPoint: outPointJson(active.cell.outPoint),
      record: { ...active.record, revokedAt: active.record.revokedAt.toString() }
    };
  }
  return { found: false, status: "NOT_FOUND" };
}
