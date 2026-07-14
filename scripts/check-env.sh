#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
pass() { printf '[PASS] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }

[[ -f "$ENV_FILE" ]] || fail ".env is missing. Run: cp .env.example .env"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

required=(APP_NETWORK CKB_RPC_URL ISSUER_NAME ISSUER_LOCK_HASH DATA_DIR ISSUER_PRIVATE_KEY_PATH ISSUER_PUBLIC_KEY_PATH TRUSTED_ISSUERS_FILE REVOCATION_CONTRACT_BIN CKB_ISSUER_PRIVATE_KEY_FILE OFFCKB_SYSTEM_SCRIPTS OFFCKB_DEPLOYMENT_SCRIPTS OFFCKB_CHAIN_STATE)
missing=()
for key in "${required[@]}"; do
  [[ -n "${!key:-}" ]] || missing+=("$key")
done
((${#missing[@]} == 0)) || fail "Missing values in .env: ${missing[*]}"
pass "All required .env values are present."

[[ "$APP_NETWORK" =~ ^(local|devnet|testnet)$ ]] || fail "APP_NETWORK must be local, devnet, or testnet."
[[ "$CKB_RPC_URL" =~ ^https?:// ]] || fail "CKB_RPC_URL must start with http:// or https://."
[[ "$ISSUER_LOCK_HASH" =~ ^0x[0-9a-fA-F]{64}$ ]] || fail "ISSUER_LOCK_HASH must contain exactly 32 bytes."
pass "Environment formats are valid."

if [[ "${REQUIRE_CKB_RPC:-0}" == "1" ]]; then
  command -v curl >/dev/null || fail "curl is required when REQUIRE_CKB_RPC=1."
  payload='{"id":1,"jsonrpc":"2.0","method":"local_node_info","params":[]}'
  curl -fsS -H 'content-type: application/json' -d "$payload" "$CKB_RPC_URL" >/dev/null \
    || fail "CKB RPC is not reachable at $CKB_RPC_URL. Start OffCKB with: offckb node"
  pass "CKB RPC responded."
else
  warn "RPC reachability is optional (REQUIRE_CKB_RPC=0). The deterministic local demo will still run."
fi

node -e 'const [major]=process.versions.node.split(".").map(Number); if(major<20) process.exit(1)' \
  || fail "Node.js 20 or newer is required."
pass "Node.js $(node --version) is supported."
