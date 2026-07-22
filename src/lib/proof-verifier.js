import { canonicalJson } from "./json.js";
import { sha256Hex } from "./crypto.js";
import { PUBLIC_PROOF_SCHEMA } from "./public-inspector.js";

const SENSITIVE_KEY_PATTERN = /(private.?key|seed|mnemonic|identity.?salt|student.?id|password|secret|token)/i;
const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:\\|\/(?:home|Users|private|var|tmp)\/)/;

function walk(value, visitor, path = "$") {
  visitor(value, path);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visitor, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) walk(item, visitor, `${path}.${key}`);
  }
}

export function publicProofDigest(proof) {
  const core = { ...proof };
  delete core.proofDigest;
  return sha256Hex(Buffer.from(canonicalJson(core), "utf8"));
}

export function findPublicProofPrivacyIssues(proof) {
  const issues = [];
  walk(proof, (value, path) => {
    const key = path.split(".").at(-1) ?? "";
    if (SENSITIVE_KEY_PATTERN.test(key) && value != null && value !== false && value !== "") {
      issues.push({ code: "SENSITIVE_FIELD_PRESENT", path });
    }
    if (typeof value === "string" && ABSOLUTE_PATH_PATTERN.test(value)) {
      issues.push({ code: "ABSOLUTE_PATH_PRESENT", path });
    }
  });
  return issues;
}

export function verifyPublicProof(proof) {
  const checks = [];
  const add = (name, ok, code, message) => checks.push({ name, ok, code, message });

  const objectValid = Boolean(proof && typeof proof === "object" && !Array.isArray(proof));
  add("proof_object", objectValid, objectValid ? "PROOF_OBJECT_VALID" : "PROOF_OBJECT_INVALID", objectValid ? "Proof is a JSON object." : "Proof must be a JSON object.");
  if (!objectValid) return { valid: false, checks, computedDigest: null, privacyIssues: [] };

  const schemaValid = proof.schema === PUBLIC_PROOF_SCHEMA;
  add("schema", schemaValid, schemaValid ? "SCHEMA_SUPPORTED" : "SCHEMA_UNSUPPORTED", schemaValid ? `Schema ${proof.schema} is supported.` : `Expected ${PUBLIC_PROOF_SCHEMA}.`);

  const credentialIdValid = typeof proof.credentialId === "string" && proof.credentialId.trim() !== "";
  add("credential_id", credentialIdValid, credentialIdValid ? "CREDENTIAL_ID_VALID" : "CREDENTIAL_ID_INVALID", credentialIdValid ? "Credential ID is present." : "Credential ID is missing.");

  const digestFormatValid = /^0x[0-9a-f]{64}$/.test(proof.proofDigest ?? "");
  const computedDigest = publicProofDigest(proof);
  const digestValid = digestFormatValid && computedDigest === proof.proofDigest;
  add("proof_digest", digestValid, digestValid ? "PROOF_DIGEST_VALID" : "PROOF_DIGEST_INVALID", digestValid ? "Proof digest matches canonical proof content." : "Proof content or digest has been modified.");

  const readOnlyValid = proof.readOnly === true && proof.privateKeyRequired === false;
  add("read_only_claim", readOnlyValid, readOnlyValid ? "READ_ONLY_CLAIM_VALID" : "READ_ONLY_CLAIM_INVALID", readOnlyValid ? "Proof declares a read-only, no-private-key inspection." : "Read-only metadata is inconsistent.");

  const outcomeValid = typeof proof.outcome === "string" && proof.outcome.length > 0;
  add("outcome", outcomeValid, outcomeValid ? "OUTCOME_PRESENT" : "OUTCOME_MISSING", outcomeValid ? `Outcome is ${proof.outcome}.` : "Outcome is missing.");

  const privacyIssues = findPublicProofPrivacyIssues(proof);
  add("privacy", privacyIssues.length === 0, privacyIssues.length === 0 ? "PUBLIC_PROOF_PRIVACY_OK" : "PUBLIC_PROOF_PRIVACY_ISSUE", privacyIssues.length === 0 ? "No obvious secret fields or absolute local paths were found." : `${privacyIssues.length} privacy issue(s) were found.`);

  const generatedAtValid = typeof proof.generatedAt === "string" && Number.isFinite(new Date(proof.generatedAt).getTime());
  add("generated_at", generatedAtValid, generatedAtValid ? "GENERATED_AT_VALID" : "GENERATED_AT_INVALID", generatedAtValid ? "Generation timestamp is valid." : "Generation timestamp is missing or invalid.");

  return {
    valid: checks.every((check) => check.ok),
    checks,
    computedDigest,
    privacyIssues
  };
}
