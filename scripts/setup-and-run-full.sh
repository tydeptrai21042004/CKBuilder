#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"


RUN_DIR="$ROOT/data/run"
LOG_DIR="$ROOT/data/logs"
INSPECTOR_PID_FILE="$RUN_DIR/inspector.pid"
OFFCKB_PID_FILE="$RUN_DIR/offckb.pid"
INSPECTOR_LOG="$LOG_DIR/public-inspector.log"
SUMMARY_FILE="$RUN_DIR/launch-summary.json"
NVM_VERSION="${NVM_VERSION:-v0.40.3}"
NODE_MAJOR="${NODE_MAJOR:-20}"
INSTALL_MISSING="${INSTALL_MISSING:-1}"
FULL_REBUILD=1
FOREGROUND=0
COMMAND="run"


info() { printf '\n[INFO] %s\n' "$*"; }
pass() { printf '[PASS] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
fail() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'TEXT'
Usage:
  bash run-full-project.sh [options]

Default action:
  Detect and reuse the existing environment, install only missing tools,
  create local development keys automatically, start OffCKB, build/test/deploy
  the contract, run the ACTIVE -> REVOKED lifecycle, and start the public
  inspector at http://127.0.0.1:4173.

Options:
  --fast          Reuse an existing successful deployment and only ensure that
                  OffCKB and the inspector are running.
  --foreground    Keep this terminal attached to the inspector log after setup.
  --status        Show service and environment status without changing anything.
  --stop          Stop only services previously started by this project.
  --restart       Stop project services, then perform the full setup and run.
  --no-install    Do not install missing operating-system, Node, Rust, or npm tools.
  -h, --help      Show this help.

Notes:
  * No browser wallet or manual account setup is required. A prefunded local
    OffCKB development account is selected automatically.
  * Existing issuer keys and configuration are reused and never overwritten.
  * On Linux/WSL, sudo may ask once for the Linux password when system packages
    are missing. This is the only possible interactive operating-system step.
  * Testnet and mainnet are never used by this launcher.
TEXT
}

while (($#)); do
  case "$1" in
    --fast) FULL_REBUILD=0 ;;
    --foreground) FOREGROUND=1 ;;
    --status) COMMAND="status" ;;
    --stop) COMMAND="stop" ;;
    --restart) COMMAND="restart" ;;
    --no-install) INSTALL_MISSING=0 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1. Run with --help." ;;
  esac
  shift
done

is_pid_running() {
  local file="$1" kind="${2:-}"
  [[ -s "$file" ]] || return 1
  local pid command_line
  pid="$(tr -dc '0-9' < "$file")"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null || return 1
  [[ -z "$kind" ]] && return 0
  command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  case "$kind" in
    offckb) [[ "$command_line" == *offckb*node* ]] ;;
    inspector) [[ "$command_line" == *inspector:serve* || "$command_line" == *public-inspector-server.js* ]] ;;
    *) return 1 ;;
  esac
}

read_pid() {
  tr -dc '0-9' < "$1" 2>/dev/null || true
}

kill_process_tree() {
  local pid="$1" child
  [[ "$pid" =~ ^[0-9]+$ ]] || return 0
  if command -v pgrep >/dev/null 2>&1; then
    while IFS= read -r child; do
      [[ -n "$child" ]] && kill_process_tree "$child"
    done < <(pgrep -P "$pid" 2>/dev/null || true)
  fi
  kill -TERM "$pid" 2>/dev/null || true
  for _ in {1..20}; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.25
  done
  kill -KILL "$pid" 2>/dev/null || true
}

rpc_ready() {
  command -v curl >/dev/null 2>&1 || return 1
  curl -fsS --max-time 2 \
    -H 'content-type: application/json' \
    -d '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}' \
    "${CKB_RPC_URL:-http://127.0.0.1:28114}" 2>/dev/null | grep -q '"result"'
}

inspector_ready() {
  command -v curl >/dev/null 2>&1 || return 1
  local host="${INSPECTOR_HOST:-127.0.0.1}"
  local port="${INSPECTOR_PORT:-4173}"
  bash "$ROOT/scripts/check-inspector-health.sh" "http://${host}:${port}/api/health" >/dev/null 2>&1
}

read_env_value() {
  local key="$1" file="$2"
  awk -v wanted="$key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line=$0
      sub(/^[[:space:]]*/, "", line)
      pos=index(line, "=")
      if (pos < 2) next
      key=substr(line, 1, pos-1)
      gsub(/[[:space:]]/, "", key)
      if (key != wanted) next
      value=substr(line, pos+1)
      sub(/^[[:space:]]*/, "", value)
      sub(/[[:space:]]*$/, "", value)
      if ((substr(value,1,1) == "\"" && substr(value,length(value),1) == "\"") ||
          (substr(value,1,1) == "\047" && substr(value,length(value),1) == "\047")) {
        value=substr(value,2,length(value)-2)
      }
      print value
      exit
    }
  ' "$file"
}

load_project_env_if_present() {
  [[ -f "$ROOT/.env" ]] || return 0
  local key value
  for key in APP_NETWORK CKB_RPC_URL REQUIRE_CKB_RPC INSPECTOR_HOST INSPECTOR_PORT INSPECTOR_MAX_UPLOAD_BYTES; do
    value="$(read_env_value "$key" "$ROOT/.env")"
    if [[ -n "$value" ]]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done
}

show_status() {
  load_project_env_if_present
  printf '\nCKB Degree Proof service status\n'
  printf '%-28s %s\n' 'Project root:' "$ROOT"
  printf '%-28s %s\n' '.env:' "$([[ -f .env ]] && echo present || echo missing)"
  printf '%-28s %s\n' 'Node.js:' "$(command -v node >/dev/null 2>&1 && node --version || echo missing)"
  printf '%-28s %s\n' 'npm:' "$(command -v npm >/dev/null 2>&1 && npm --version || echo missing)"
  printf '%-28s %s\n' 'Rust:' "$(command -v rustc >/dev/null 2>&1 && rustc --version || echo missing)"
  printf '%-28s %s\n' 'RISC-V GCC:' "$(command -v riscv64-unknown-elf-gcc >/dev/null 2>&1 && riscv64-unknown-elf-gcc --version | head -1 || echo missing)"
  printf '%-28s %s\n' 'OffCKB RPC:' "$(rpc_ready && echo running || echo stopped)"
  if is_pid_running "$OFFCKB_PID_FILE" offckb; then
    printf '%-28s %s\n' 'Managed OffCKB PID:' "$(read_pid "$OFFCKB_PID_FILE")"
  else
    printf '%-28s %s\n' 'Managed OffCKB PID:' 'none'
  fi
  printf '%-28s %s\n' 'Inspector API:' "$(inspector_ready && echo running || echo stopped)"
  if is_pid_running "$INSPECTOR_PID_FILE" inspector; then
    printf '%-28s %s\n' 'Managed inspector PID:' "$(read_pid "$INSPECTOR_PID_FILE")"
  else
    printf '%-28s %s\n' 'Managed inspector PID:' 'none'
  fi
  [[ -f "$SUMMARY_FILE" ]] && printf '%-28s %s\n' 'Last launch summary:' "$SUMMARY_FILE"
  return 0
}

stop_services() {
  local stopped=0
  if is_pid_running "$INSPECTOR_PID_FILE" inspector; then
    local pid
    pid="$(read_pid "$INSPECTOR_PID_FILE")"
    info "Stopping the public inspector started by this project (PID $pid)."
    kill_process_tree "$pid"
    stopped=1
  fi
  rm -f "$INSPECTOR_PID_FILE"

  if is_pid_running "$OFFCKB_PID_FILE" offckb; then
    local pid
    pid="$(read_pid "$OFFCKB_PID_FILE")"
    info "Stopping the OffCKB node started by this project (PID $pid)."
    kill_process_tree "$pid"
    stopped=1
  fi
  rm -f "$OFFCKB_PID_FILE"

  if [[ "$stopped" == "0" ]]; then
    pass "No managed project services were running. External OffCKB processes were not touched."
  else
    pass "Managed project services stopped."
  fi
}

if [[ "$COMMAND" == "status" ]]; then
  show_status
  exit 0
fi
if [[ "$COMMAND" == "stop" ]]; then
  stop_services
  exit 0
fi
if [[ "$COMMAND" == "restart" ]]; then
  stop_services
fi

mkdir -p "$RUN_DIR" "$LOG_DIR"

case "$(uname -s 2>/dev/null || true)" in
  MINGW*|MSYS*|CYGWIN*)
    fail "Run this .sh file inside WSL2, not Git Bash/Cygwin. The CKB RISC-V toolchain and OffCKB workflow are supported here on Linux/WSL and macOS."
    ;;
esac

run_privileged() {
  if [[ "$(id -u)" == "0" ]]; then
    "$@"
  elif command -v sudo >/dev/null 2>&1; then
    sudo "$@"
  else
    fail "System packages are missing and neither root access nor sudo is available."
  fi
}

ensure_bootstrap_tools() {
  local missing=()
  for tool in curl git unzip; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  ((${#missing[@]} == 0)) && { pass "Bootstrap tools already exist: curl, git, unzip."; return; }
  [[ "$INSTALL_MISSING" == "1" ]] || fail "Missing bootstrap tools: ${missing[*]}"

  info "Installing missing bootstrap tools: ${missing[*]}"
  if command -v apt-get >/dev/null 2>&1; then
    run_privileged apt-get update
    run_privileged env DEBIAN_FRONTEND=noninteractive apt-get install -y curl ca-certificates git unzip
  elif command -v brew >/dev/null 2>&1; then
    brew install curl git unzip
  else
    fail "Automatic bootstrap supports apt-get or Homebrew. Install curl, git, and unzip, then rerun."
  fi
  for tool in curl git unzip; do command -v "$tool" >/dev/null 2>&1 || fail "$tool is still missing."; done
  pass "Bootstrap tools installed."
}

source_nvm() {
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  [[ -s "$NVM_DIR/nvm.sh" ]] || return 1
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
}

node_supported() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 && \
    node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' >/dev/null 2>&1
}

ensure_node() {
  source_nvm || true
  if node_supported; then
    pass "Reusing Node $(node --version) and npm $(npm --version)."
    return
  fi
  [[ "$INSTALL_MISSING" == "1" ]] || fail "Node.js 20+ and npm are required."

  if ! command -v nvm >/dev/null 2>&1; then
    info "Installing pinned nvm $NVM_VERSION in the current user account."
    export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    source_nvm || fail "nvm installation completed but nvm.sh could not be loaded."
  fi
  info "Installing Node.js ${NODE_MAJOR}. Existing compatible Node installations are never replaced."
  nvm install "$NODE_MAJOR"
  nvm use "$NODE_MAJOR"
  nvm alias default "$NODE_MAJOR" >/dev/null
  node_supported || fail "Node.js installation did not produce Node 20+ with npm."
  pass "Node $(node --version) and npm $(npm --version) are ready."
}

ensure_bootstrap_tools
ensure_node

# Make the Node selected above visible to child login shells and service commands.
export PATH="$(dirname "$(command -v node)"):$PATH"

load_project_env_if_present

# The automatic launcher is intentionally local-only. Process environment
# values override any older .env network settings without contacting testnet
# or mainnet. The full runner writes these safe local values back to .env.
export APP_NETWORK="devnet"
export CKB_RPC_URL="${LOCAL_CKB_RPC_URL:-http://127.0.0.1:28114}"
export REQUIRE_CKB_RPC="1"

if [[ ! "$CKB_RPC_URL" =~ ^http://(127\.0\.0\.1|localhost)(:[0-9]+)?/?$ ]]; then
  fail "LOCAL_CKB_RPC_URL must be a loopback HTTP URL. Refusing non-local RPC: $CKB_RPC_URL"
fi

if [[ "$FULL_REBUILD" == "1" ]]; then
  info "Running the full local build, tests, automatic wallet setup, deployment, and chain lifecycle."
  INSTALL_MISSING="$INSTALL_MISSING" \
  KEEP_OFFCKB_NODE=1 \
  OFFCKB_PID_FILE="$OFFCKB_PID_FILE" \
  bash "$ROOT/scripts/local-offckb-all.sh"
else
  info "Fast mode selected: reusing the existing build and deployment."
  [[ -f "$ROOT/.env" ]] || fail ".env is missing. Run once without --fast."
  [[ -s "$ROOT/deployment/scripts.json" ]] || fail "deployment/scripts.json is missing. Run once without --fast."
  if ! rpc_ready; then
    [[ -x "$ROOT/node_modules/.bin/offckb" ]] || fail "OffCKB is not installed. Run once without --fast."
    info "Starting the existing local OffCKB environment."
    nohup "$ROOT/node_modules/.bin/offckb" node </dev/null >"$LOG_DIR/offckb-node.log" 2>&1 &
    echo "$!" > "$OFFCKB_PID_FILE"
    for _ in {1..150}; do rpc_ready && break; sleep 2; done
    rpc_ready || fail "OffCKB RPC did not become ready. See $LOG_DIR/offckb-node.log"
  fi
  pass "OffCKB RPC is ready."
fi

# Reload values written by local-offckb-all.sh.
load_project_env_if_present

start_inspector() {
  if inspector_ready; then
    pass "Public inspector is already responding at http://${INSPECTOR_HOST:-127.0.0.1}:${INSPECTOR_PORT:-4173}."
    return
  fi
  if is_pid_running "$INSPECTOR_PID_FILE" inspector; then
    warn "A managed inspector process exists but is not healthy. Restarting it."
    kill_process_tree "$(read_pid "$INSPECTOR_PID_FILE")"
    rm -f "$INSPECTOR_PID_FILE"
  fi

  info "Starting the read-only public inspector without loading issuer private keys."
  nohup env \
    PATH="$PATH" \
    INSPECTOR_HOST="${INSPECTOR_HOST:-127.0.0.1}" \
    INSPECTOR_PORT="${INSPECTOR_PORT:-4173}" \
    npm run inspector:serve </dev/null >"$INSPECTOR_LOG" 2>&1 &
  echo "$!" > "$INSPECTOR_PID_FILE"

  for _ in {1..60}; do
    inspector_ready && break
    is_pid_running "$INSPECTOR_PID_FILE" inspector || { tail -100 "$INSPECTOR_LOG" >&2 || true; fail "Inspector exited during startup."; }
    sleep 1
  done
  if ! inspector_ready; then
    warn "Inspector process is running, but the health response was not accepted."
    warn "Direct health response follows:"
    curl -sS --max-time 2 "http://${INSPECTOR_HOST:-127.0.0.1}:${INSPECTOR_PORT:-4173}/api/health" >&2 || true
    printf '\n' >&2
    tail -100 "$INSPECTOR_LOG" >&2 || true
    fail "Inspector health endpoint did not become ready."
  fi
  pass "Public inspector is ready."
}

CREDENTIAL_ID=""
if [[ -f "$ROOT/data/offckb-chain-state.json" ]]; then
  CREDENTIAL_ID="$(node --input-type=module -e 'import fs from "node:fs"; const x=JSON.parse(fs.readFileSync(process.argv[1],"utf8")); process.stdout.write(x.credentialId ?? "")' "$ROOT/data/offckb-chain-state.json" 2>/dev/null || true)"
fi
[[ -n "$CREDENTIAL_ID" ]] || fail "The lifecycle completed without recording a credential ID."

start_inspector

PUBLIC_PROOF_FILE="$ROOT/data/automatic-public-verification-proof.json"
PUBLIC_PROOF_LOG="$LOG_DIR/public-proof-export.log"
info "Exporting and independently verifying the integrated public credential proof."
if ! npm run --silent credential:inspect -- \
  "$CREDENTIAL_ID" \
  "$ROOT/examples/certificate-original.pdf" \
  --export="$PUBLIC_PROOF_FILE" >"$PUBLIC_PROOF_LOG" 2>&1; then
  tail -100 "$PUBLIC_PROOF_LOG" >&2 || true
  fail "Public proof export failed."
fi
npm run --silent proof:verify -- "$PUBLIC_PROOF_FILE" >>"$PUBLIC_PROOF_LOG" 2>&1 \
  || { tail -100 "$PUBLIC_PROOF_LOG" >&2 || true; fail "Exported public proof verification failed."; }
node --input-type=module - "$PUBLIC_PROOF_FILE" "$CREDENTIAL_ID" <<'NODE'
import fs from "node:fs";
const [file, expectedId] = process.argv.slice(2);
const proof = JSON.parse(fs.readFileSync(file, "utf8"));
if (proof.credentialId !== expectedId) throw new Error("Public proof credential ID mismatch.");
if (proof.offChain?.status !== "REVOKED" || proof.onChain?.status !== "REVOKED") {
  throw new Error("The integrated proof must report REVOKED off-chain and on-chain.");
}
if (proof.stateConsistency?.consistent !== true) throw new Error("Integrated proof state is inconsistent.");
if (proof.privateKeyRequired !== false || proof.readOnly !== true) throw new Error("Public proof lost its read-only boundary.");
NODE
pass "Integrated public proof is read-only, internally consistent, and bound to the lifecycle credential."

node --input-type=module - "$SUMMARY_FILE" "${CKB_RPC_URL:-http://127.0.0.1:28114}" "${INSPECTOR_HOST:-127.0.0.1}" "${INSPECTOR_PORT:-4173}" "$CREDENTIAL_ID" <<'NODE'
import fs from "node:fs";
import path from "node:path";
const [file, rpcUrl, host, port, credentialId] = process.argv.slice(2);
const summary = {
  schema: "ckb-degree-local-launch/v1",
  generatedAt: new Date().toISOString(),
  network: "local-offckb-devnet",
  rpcUrl,
  inspectorUrl: `http://${host}:${port}`,
  credentialId: credentialId || null,
  walletSetup: "automatic-prefunded-offckb-development-account",
  privateKeyScope: "local-development-only",
  services: {
    offckbPidFile: "data/run/offckb.pid",
    inspectorPidFile: "data/run/inspector.pid"
  },
  evidence: {
    chainState: "data/offckb-chain-state.json",
    deployment: "deployment/scripts.json",
    contractChecksum: "data/credential-revocation.sha256",
    publicProof: "data/automatic-public-verification-proof.json",
    publicProofLog: "data/logs/public-proof-export.log",
    nodeLog: "data/logs/offckb-node.log",
    inspectorLog: "data/logs/public-inspector.log"
  }
};
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, `${JSON.stringify(summary, null, 2)}\n`);
NODE

cat <<SUMMARY

======================================================================
CKB DEGREE PROOF — AUTOMATIC END-TO-END STARTUP COMPLETED
======================================================================
Inspector:             http://${INSPECTOR_HOST:-127.0.0.1}:${INSPECTOR_PORT:-4173}
OffCKB RPC:            ${CKB_RPC_URL:-http://127.0.0.1:28114}
Network:               local OffCKB devnet only
Credential ID:         ${CREDENTIAL_ID:-see data/offckb-chain-state.json}
Wallet setup:          automatic prefunded OffCKB development account
Issuer signing keys:   automatically created once, then safely reused
Deployment:            deployment/scripts.json
Lifecycle evidence:    data/offckb-chain-state.json
Public proof:          data/automatic-public-verification-proof.json
Launch summary:        data/run/launch-summary.json
Inspector log:         data/logs/public-inspector.log
OffCKB log:            data/logs/offckb-node.log

Useful commands:
  bash run-full-project.sh --status
  bash run-full-project.sh --fast
  bash run-full-project.sh --restart
  bash run-full-project.sh --stop

No browser wallet, testnet funds, seed phrase, or manual account import is needed.
The generated OffCKB key is local-development-only and must never hold assets.
======================================================================
SUMMARY

if [[ "$FOREGROUND" == "1" ]]; then
  info "Following the inspector log. Press Ctrl+C to stop following; services remain running."
  tail -n 50 -f "$INSPECTOR_LOG"
fi
