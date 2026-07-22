import fs from "node:fs";
import path from "node:path";
import { AppError } from "./errors.js";
import { sha256Hex } from "./crypto.js";
import { canonicalJson, readJson, writeJsonAtomic } from "./json.js";
import { credentialHash } from "./revocation-binary.js";
import { verifyCredentialPublic } from "./credential-service.js";

export const PUBLIC_PROOF_SCHEMA = "ckb-degree-public-verification-proof/v2";

function normalizeHistory(statePath, credentialId) {
  if (!statePath || !fs.existsSync(statePath)) {
    return { available: false, source: null, steps: [] };
  }

  let state;
  try {
    state = readJson(statePath);
  } catch {
    return { available: false, source: "INVALID_STATE_FILE", steps: [] };
  }
  if (!state || state.credentialId !== credentialId) {
    return { available: false, source: "NO_MATCHING_STATE_EVIDENCE", steps: [] };
  }

  const active = state.active ?? (state.status === "ACTIVE" ? state : undefined);
  const revocation = state.revocation ?? (state.status === "REVOKED" ? state : undefined);
  const steps = [];
  if (active?.txHash) {
    steps.push({
      state: "ACTIVE",
      txHash: active.txHash,
      outPoint: active.outPoint ?? { txHash: active.txHash, index: 0 }
    });
  }
  if (revocation?.txHash) {
    steps.push({
      state: "REVOKED",
      txHash: revocation.txHash,
      outPoint: revocation.outPoint ?? { txHash: revocation.txHash, index: 0 },
      consumedActiveOutPoint: revocation.spentActiveOutPoint ?? null,
      reasonCode: revocation.reasonCode ?? null,
      revokedAt: revocation.revokedAt ?? null
    });
  }

  return {
    available: steps.length > 0,
    source: "OFFCKB_CHAIN_STATE_EVIDENCE",
    note: "Transaction history is loaded from the saved execution evidence; the current live Cell is checked independently through RPC.",
    steps
  };
}

function compareStates(offChainStatus, chainStatus) {
  if (chainStatus === "RPC_UNAVAILABLE" || chainStatus === "NOT_CHECKED") {
    return { consistent: null, code: chainStatus, message: "On-chain state was not available for comparison." };
  }
  if (chainStatus === "CONFLICT_DUPLICATE") {
    return { consistent: false, code: "CHAIN_CONFLICT", message: "More than one live registry Cell exists for this credential." };
  }
  if (chainStatus === "INVALID_RECORD") {
    return { consistent: false, code: "CHAIN_RECORD_INVALID", message: "The matching live registry Cell has invalid binary fields." };
  }
  if (chainStatus === "NOT_FOUND") {
    return { consistent: false, code: "ONCHAIN_RECORD_NOT_FOUND", message: "No live registry Cell was found for this credential." };
  }
  if (!offChainStatus) {
    return { consistent: false, code: "OFFCHAIN_RECORD_NOT_FOUND", message: "On-chain evidence exists but the public credential record is missing." };
  }
  if (offChainStatus !== chainStatus) {
    return {
      consistent: false,
      code: "STATE_MISMATCH",
      message: `Off-chain status ${offChainStatus} does not match live on-chain status ${chainStatus}.`
    };
  }
  return { consistent: true, code: "STATE_CONSISTENT", message: `Off-chain and live on-chain status both report ${chainStatus}.` };
}

function selectOutcome({ verification, chain, consistency }) {
  const credentialMissing = verification.checks.some((check) => check.code === "CREDENTIAL_NOT_FOUND");
  if (credentialMissing && chain.status === "NOT_FOUND") return "NOT_FOUND";
  if (credentialMissing && ["ACTIVE", "REVOKED"].includes(chain.status)) return "OFFCHAIN_RECORD_NOT_FOUND";
  if (chain.status === "CONFLICT_DUPLICATE") return "CONFLICT_DUPLICATE";
  if (chain.status === "INVALID_RECORD") return "INVALID_CHAIN_RECORD";
  if (!verification.integrityValid) return "INVALID_EVIDENCE";
  if (chain.status === "NOT_CHECKED") return "CHAIN_NOT_CHECKED";
  if (consistency.consistent === false) return consistency.code;
  if (chain.status === "RPC_UNAVAILABLE") return "RPC_UNAVAILABLE";
  if (verification.status === "REVOKED") return "REVOKED";
  if (verification.status === "ACTIVE" && verification.documentVerified) return "ACTIVE_VALID";
  if (verification.status === "ACTIVE") return "ACTIVE_DOCUMENT_NOT_CHECKED";
  return "INDETERMINATE";
}

function sanitizeRpcUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "INVALID_RPC_URL";
  }
}

async function defaultChainInspector(env, credentialId) {
  const { inspectRecord } = await import("../ckb/local-chain.js");
  return inspectRecord(env, credentialId, { attempts: 1, delayMs: 0 });
}

/**
 * Build a public, read-only verification proof. The function uses only public
 * credential data, trusted issuer data, a document supplied by the verifier,
 * and CKB RPC/indexer reads. It never loads a private key.
 */
export async function inspectPublicCredential(env, credentialId, options = {}) {
  if (typeof credentialId !== "string" || credentialId.trim() === "") {
    throw new AppError("CREDENTIAL_ID_INVALID", "credentialId is required.");
  }

  const normalizedId = credentialId.trim();
  const verification = verifyCredentialPublic(env, normalizedId, options.documentPath, options.verificationOptions ?? {});
  const chainInspector = options.chainInspector ?? defaultChainInspector;
  let chain;
  try {
    chain = options.skipChain
      ? { found: false, status: "NOT_CHECKED", readOnly: true, records: [] }
      : await chainInspector(env, normalizedId);
  } catch (error) {
    chain = {
      found: false,
      status: "RPC_UNAVAILABLE",
      readOnly: true,
      records: [],
      error: options.includeDebugError
        ? (error instanceof Error ? error.message : String(error))
        : "Live CKB inspection failed. Check RPC availability and public deployment metadata."
    };
  }

  const consistency = compareStates(verification.status, chain.status);
  const history = normalizeHistory(env.OFFCKB_CHAIN_STATE, normalizedId);
  const generatedAt = options.now ?? new Date().toISOString();
  const outcome = selectOutcome({ verification, chain, consistency });

  const proofCore = {
    schema: PUBLIC_PROOF_SCHEMA,
    proofVersion: "2.1.0",
    generatedAt,
    credentialId: normalizedId,
    credentialHash: credentialHash(normalizedId),
    network: env.APP_NETWORK,
    rpcUrl: sanitizeRpcUrl(env.CKB_RPC_URL),
    readOnly: true,
    privateKeyRequired: false,
    formats: {
      cellData: "ckb-degree-credential-cell/v1",
      publicProof: PUBLIC_PROOF_SCHEMA,
      testVectors: "ckb-degree-cell-test-vectors/v1"
    },
    outcome,
    usableAsActiveCredential:
      outcome === "ACTIVE_VALID" && verification.valid && chain.status === "ACTIVE" && consistency.consistent === true,
    offChain: {
      status: verification.status,
      valid: verification.valid,
      integrityValid: verification.integrityValid,
      complete: verification.complete,
      documentVerified: verification.documentVerified,
      credential: verification.credential,
      checks: verification.checks
    },
    onChain: chain,
    stateConsistency: consistency,
    history,
    limitations: [
      "The Type Script enforces issuer-lock ownership and an irreversible ACTIVE to REVOKED transition for one Cell lineage.",
      "Global uniqueness across newly created Cells with the same credential hash is not yet enforced.",
      "Saved history evidence is supplementary; the live Cell status is the independently queried chain result."
    ]
  };

  return {
    ...proofCore,
    proofDigest: sha256Hex(Buffer.from(canonicalJson(proofCore), "utf8"))
  };
}

export function exportPublicProof(filePath, proof) {
  const absolute = path.resolve(filePath);
  writeJsonAtomic(absolute, proof);
  return absolute;
}
