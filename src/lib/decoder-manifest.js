import { loadContractInfo } from "../ckb/offckb-config.js";

export const DECODER_MANIFEST_SCHEMA = "ckb-degree-decoder-manifest/v1";

function sanitizeRpcUrl(value) {
  const url = new URL(value);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function buildDecoderManifest(env, options = {}) {
  const contract = options.contract ?? loadContractInfo(env.OFFCKB_DEPLOYMENT_SCRIPTS);
  if (!/^0x[0-9a-fA-F]{64}$/.test(contract.codeHash ?? "")) {
    throw new Error("Deployment contract codeHash must be 0x followed by 64 hexadecimal characters.");
  }
  if (!new Set(["data", "data1", "data2", "type"]).has(contract.hashType)) {
    throw new Error("Deployment contract hashType is unsupported.");
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(env.ISSUER_LOCK_HASH ?? "")) {
    throw new Error("ISSUER_LOCK_HASH must be 32 bytes.");
  }

  return {
    schema: DECODER_MANIFEST_SCHEMA,
    protocol: "ckb-degree-credential-cell/v1",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    network: env.APP_NETWORK,
    rpcUrl: options.includeRpcUrl === true ? sanitizeRpcUrl(env.CKB_RPC_URL) : undefined,
    typeScript: {
      codeHash: contract.codeHash.toLowerCase(),
      hashType: contract.hashType,
      argsRule: "exactly 32 bytes containing the issuer Lock Script hash",
      exampleArgs: env.ISSUER_LOCK_HASH.toLowerCase()
    },
    recordLength: 75,
    decoder: "community/decoder/credential-cell-decoder.js",
    testVectors: "community/test-vectors/credential-cell-v1.json",
    specification: "docs/CREDENTIAL_CELL_DATA_FORMAT.md",
    officialStandard: false,
    limitations: [
      "Match the Type Script code hash and hash type before decoding.",
      "Type Script args identify an issuer and vary between deployments.",
      "Global uniqueness across independent Cell lineages is not enforced."
    ]
  };
}
