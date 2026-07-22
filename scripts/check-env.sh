#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/.env"
cd "$ROOT"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
pass() { printf '[PASS] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }

[[ -f "$ENV_FILE" ]] || fail ".env is missing. Run: cp .env.example .env"
command -v node >/dev/null 2>&1 || fail "Node.js 20+ is required."
node -e 'const [major]=process.versions.node.split(".").map(Number); if(major<20) process.exit(1)' \
  || fail "Node.js 20 or newer is required."

ENV_SUMMARY="$(node --input-type=module - "$ROOT" <<'NODE'
import { loadEnv } from "./src/lib/env.js";
const root = process.argv[2];
const env = loadEnv(root);
process.stdout.write(JSON.stringify({
  network: env.APP_NETWORK,
  rpcUrl: env.CKB_RPC_URL,
  requireRpc: env.REQUIRE_CKB_RPC
}));
NODE
)" || fail "Environment validation failed. See the error above."

pass "All required .env values and formats are valid."
pass "Node.js $(node --version) is supported."

REQUIRE_RPC="$(node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write(x.requireRpc?"1":"0")' "$ENV_SUMMARY")"
RPC_URL="$(node -e 'const x=JSON.parse(process.argv[1]); process.stdout.write(x.rpcUrl)' "$ENV_SUMMARY")"

if [[ "$REQUIRE_RPC" == "1" ]]; then
  command -v curl >/dev/null 2>&1 || fail "curl is required when REQUIRE_CKB_RPC=1."
  payload='{"id":1,"jsonrpc":"2.0","method":"local_node_info","params":[]}'
  curl -fsS -H 'content-type: application/json' -d "$payload" "$RPC_URL" >/dev/null \
    || fail "CKB RPC is not reachable at $RPC_URL. Start the automatic launcher with: bash run-full-project.sh"
  pass "CKB RPC responded."
else
  warn "RPC reachability is optional (REQUIRE_CKB_RPC=0). The deterministic local demo can still run."
fi
