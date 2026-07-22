#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

OFFCKB_VERSION="${OFFCKB_VERSION:-0.4.8}"
RPC_URL="${CKB_RPC_URL:-http://127.0.0.1:28114}"
LOG_DIR="$ROOT/data/logs"
NODE_LOG="$LOG_DIR/offckb-node.log"
ACCOUNT_RAW="$LOG_DIR/offckb-accounts.txt"
SYSTEM_SCRIPTS="$ROOT/deployment/system-scripts.json"
DEPLOYMENT_DIR="$ROOT/deployment"
PRIVATE_KEY_FILE="$ROOT/secrets/offckb-issuer-private-key"
CONTRACT_BIN="$ROOT/digital-credentials-workspace/build/release/credential-revocation"
LOCAL_CHAIN_CREDENTIAL_ID="${LOCAL_CHAIN_CREDENTIAL_ID:-CKB-DEGREE-LOCAL-$(date +%Y%m%d%H%M%S)}"
STARTED_NODE=0
NODE_PID=""

mkdir -p "$LOG_DIR" "$ROOT/secrets" "$DEPLOYMENT_DIR"
chmod 700 "$ROOT/secrets" 2>/dev/null || true

info() { printf '\n[INFO] %s\n' "$*"; }
pass() { printf '[PASS] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*" >&2; }
fail() { printf '\n[ERROR] %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ "$STARTED_NODE" == "1" && "${KEEP_OFFCKB_NODE:-0}" != "1" && -n "$NODE_PID" ]]; then
    info "Stopping the OffCKB process started by this script."
    kill "$NODE_PID" 2>/dev/null || true
    pkill -P "$NODE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

require_base_tools() {
  command -v bash >/dev/null || fail "bash is required."
  command -v curl >/dev/null || fail "curl is required."
  command -v node >/dev/null || fail "Node.js 20+ is required before this script can run."
  command -v npm >/dev/null || fail "npm is required before this script can run."
  node -e 'const m=Number(process.versions.node.split(".")[0]); process.exit(m>=20?0:1)' \
    || fail "Node.js 20 or newer is required; found $(node --version)."
  pass "Base tools are available: Node $(node --version), npm $(npm --version)."
}

install_build_tools_if_possible() {
  local missing=()
  command -v make >/dev/null || missing+=(make)
  command -v cc >/dev/null || missing+=(host-c-compiler)
  command -v riscv64-unknown-elf-gcc >/dev/null || missing+=(riscv64-unknown-elf-gcc)
  command -v riscv64-unknown-elf-ar >/dev/null || missing+=(riscv64-unknown-elf-ar)

  if ((${#missing[@]} == 0)); then
    pass "Host tools and the RISC-V bare-metal C cross-toolchain are already installed."
    return 0
  fi

  info "Missing system build tools: ${missing[*]}. Installing the required packages."

  if command -v apt-get >/dev/null; then
    local -a elevate=()

    if [[ "$(id -u)" == "0" ]]; then
      elevate=()
    elif command -v sudo >/dev/null; then
      if sudo -n true 2>/dev/null; then
        elevate=(sudo)
      elif [[ -t 0 && -t 1 ]]; then
        info "WSL/Linux administrator permission is required once. Enter your Linux sudo password when prompted."
        sudo -v || fail "sudo authentication failed. Re-run the script and enter the correct Linux password."
        elevate=(sudo)
      else
        fail "Administrator permission is required, but this shell is non-interactive. Run the script from a normal WSL terminal."
      fi
    else
      fail "apt-get is available, but neither root access nor sudo is available."
    fi

    "${elevate[@]}" apt-get update
    "${elevate[@]}" env DEBIAN_FRONTEND=noninteractive \
      apt-get install -y make build-essential pkg-config libssl-dev ca-certificates gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf

  elif command -v brew >/dev/null; then
    brew install make pkg-config openssl riscv-tools
  else
    fail "Cannot automatically install the host tools and RISC-V bare-metal C cross-compiler on this operating system."
  fi

  command -v make >/dev/null || fail "make is still unavailable after installation."
  command -v cc >/dev/null || fail "The host C compiler is still unavailable after installation."
  command -v riscv64-unknown-elf-gcc >/dev/null || fail "riscv64-unknown-elf-gcc is still unavailable after installation."
  command -v riscv64-unknown-elf-ar >/dev/null || fail "riscv64-unknown-elf-ar is still unavailable after installation."
  pass "Build tools installed: $(make --version | head -1); $(riscv64-unknown-elf-gcc --version | head -1)."
}


configure_npm_public_registry() {
  local public_registry="https://registry.npmjs.org/"
  local current_registry
  current_registry="$(npm config get registry 2>/dev/null || true)"

  if [[ -n "$current_registry" ]]; then
    info "npm registry before override: $current_registry"
  fi

  # Force the official public registry for this script only. This overrides
  # stale user/global npmrc values without permanently changing the machine.
  export npm_config_registry="$public_registry"
  export NPM_CONFIG_REGISTRY="$public_registry"

  # Remove npm-specific proxy overrides that may point to an unavailable
  # private package gateway. General HTTP(S)_PROXY values are left untouched.
  unset npm_config_proxy npm_config_https_proxy NPM_CONFIG_PROXY NPM_CONFIG_HTTPS_PROXY || true
  pass "npm is configured to use the public registry for this run."
}

require_public_npm_registry() {
  info "Checking access to the public npm registry."
  if ! npm ping --registry="https://registry.npmjs.org/" --fetch-timeout=30000 >/dev/null 2>&1; then
    fail "Cannot reach https://registry.npmjs.org/. Check Windows/WSL internet, VPN, DNS, or firewall settings."
  fi
  pass "Public npm registry is reachable."
}

install_rust_if_missing() {
  # Reuse an existing rustup installation even when ~/.cargo/bin has not yet
  # been added to PATH by the current WSL shell.
  if [[ -f "$HOME/.cargo/env" ]]; then
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
  fi
  if ! command -v cargo >/dev/null || ! command -v rustup >/dev/null; then
    info "Rust is missing. Installing the minimal Rust toolchain automatically."
    curl --proto '=https' --tlsv1.2 -fsSL https://sh.rustup.rs \
      | sh -s -- -y --profile minimal --default-toolchain stable
    # shellcheck disable=SC1091
    source "$HOME/.cargo/env"
  fi
  rustup toolchain install stable --profile minimal >/dev/null
  rustup default stable >/dev/null
  rustup component add rustfmt
  rustup target add riscv64imac-unknown-none-elf
  pass "Rust $(rustc --version) and CKB RISC-V target are ready."
}

rpc_ready() {
  curl -fsS --max-time 3 \
    -H 'content-type: application/json' \
    -d '{"id":1,"jsonrpc":"2.0","method":"get_tip_block_number","params":[]}' \
    "$RPC_URL" 2>/dev/null | grep -q '"result"'
}

wait_for_rpc() {
  local limit="${OFFCKB_START_TIMEOUT_SECONDS:-300}"
  local elapsed=0
  until rpc_ready; do
    if [[ -n "$NODE_PID" ]] && ! kill -0 "$NODE_PID" 2>/dev/null; then
      tail -100 "$NODE_LOG" >&2 || true
      fail "OffCKB exited before its RPC became ready."
    fi
    ((elapsed+=2))
    (( elapsed <= limit )) || { tail -100 "$NODE_LOG" >&2 || true; fail "OffCKB RPC did not become ready within ${limit}s."; }
    sleep 2
  done
  pass "OffCKB RPC is responding at $RPC_URL."
}

set_env_value() {
  local key="$1" value="$2"
  node - "$ROOT/.env" "$key" "$value" <<'NODE'
const fs = require("node:fs");
const [file, key, value] = process.argv.slice(2);
let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
const line = `${key}=${value}`;
const re = new RegExp(`^${key}=.*$`, "m");
text = re.test(text) ? text.replace(re, line) : `${text.trimEnd()}\n${line}\n`;
fs.writeFileSync(file, text);
NODE
}

extract_first_account() {
  "$ROOT/node_modules/.bin/offckb" accounts >"$ACCOUNT_RAW" 2>&1
  local private_key address
  private_key="$(awk '/- "#": 0/{seen=1; next} seen && /^privkey:/{print $2; exit}' "$ACCOUNT_RAW")"
  address="$(awk '/- "#": 0/{seen=1; next} seen && /^address:/{print $2; exit}' "$ACCOUNT_RAW")"
  [[ "$private_key" =~ ^0x[0-9a-fA-F]{64}$ ]] || fail "Could not parse the first OffCKB private key."
  [[ "$address" == ckt1* ]] || fail "Could not parse the first OffCKB address."
  printf '%s\n' "$private_key" >"$PRIVATE_KEY_FILE"
  chmod 600 "$PRIVATE_KEY_FILE"
  set_env_value CKB_ISSUER_PRIVATE_KEY_FILE "./secrets/offckb-issuer-private-key"
  set_env_value CKB_ISSUER_ADDRESS "$address"
  pass "Selected the first prefunded OffCKB account: $address"
}

require_base_tools
install_build_tools_if_possible
install_rust_if_missing
configure_npm_public_registry

info "Preparing JavaScript dependencies."

# A lockfile generated against a private registry can contain absolute tarball
# URLs. npm follows those URLs even when `npm config get registry` is public.
# Remove only contaminated lock metadata; keep a valid node_modules directory
# so rerunning this script does not require another network download.
INTERNAL_REGISTRY_RE='packages\.applied-caas-gateway|artifactory/api/npm|internal\.api\.openai\.org'
if [[ -f "$ROOT/package-lock.json" ]] && grep -qE "$INTERNAL_REGISTRY_RE" "$ROOT/package-lock.json"; then
  warn "Removing package-lock.json because it pins an unavailable internal registry."
  rm -f "$ROOT/package-lock.json"
fi
if [[ -f "$ROOT/npm-shrinkwrap.json" ]] && grep -qE "$INTERNAL_REGISTRY_RE" "$ROOT/npm-shrinkwrap.json"; then
  warn "Removing npm-shrinkwrap.json because it pins an unavailable internal registry."
  rm -f "$ROOT/npm-shrinkwrap.json"
fi
if [[ -f "$ROOT/node_modules/.package-lock.json" ]] && grep -qE "$INTERNAL_REGISTRY_RE" "$ROOT/node_modules/.package-lock.json"; then
  warn "Removing contaminated node_modules metadata. Installed packages will be revalidated."
  rm -f "$ROOT/node_modules/.package-lock.json"
fi

cat > "$ROOT/.npmrc" <<'NPMRC'
registry=https://registry.npmjs.org/
omit-lockfile-registry-resolved=true
audit=false
fund=false
NPMRC

js_dependencies_ready() {
  [[ -x "$ROOT/node_modules/.bin/offckb" ]] || return 1
  node --input-type=module -e "import('@ckb-ccc/core')" >/dev/null 2>&1 || return 1
  npm ls --depth=0 --silent @ckb-ccc/core@1.16.1 @offckb/cli@0.4.8 >/dev/null 2>&1 || return 1
}

if js_dependencies_ready; then
  pass "Pinned JavaScript dependencies are already installed; reusing node_modules."
else
  require_public_npm_registry
  npm cache verify >/dev/null 2>&1 || true
  info "Installing pinned JavaScript dependencies from registry.npmjs.org."
  npm_command=(install)
  [[ -f "$ROOT/package-lock.json" ]] && npm_command=(ci)
  npm "${npm_command[@]}" \
    --registry="https://registry.npmjs.org/" \
    --omit-lockfile-registry-resolved=true \
    --no-audit \
    --no-fund \
    --fetch-retries=5 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=120000 \
    --fetch-timeout=600000
fi

if grep -RqsE "$INTERNAL_REGISTRY_RE" \
  "$ROOT/package-lock.json" "$ROOT/node_modules/.package-lock.json" 2>/dev/null; then
  fail "npm lock metadata still references an internal registry."
fi
js_dependencies_ready || fail "Pinned JavaScript dependencies are incomplete after installation."
pass "JavaScript dependencies are ready."

[[ -f .env ]] || cp .env.example .env
set_env_value APP_NETWORK devnet
set_env_value CKB_RPC_URL "$RPC_URL"
set_env_value REQUIRE_CKB_RPC 1
set_env_value OFFCKB_SYSTEM_SCRIPTS "./deployment/system-scripts.json"
set_env_value OFFCKB_DEPLOYMENT_SCRIPTS "./deployment/scripts.json"
set_env_value OFFCKB_CHAIN_STATE "./data/offckb-chain-state.json"

extract_first_account

if rpc_ready; then
  pass "An OffCKB node is already running; it will be reused."
else
  info "Starting a local OffCKB blockchain. The first launch may download the CKB binary."
  "$ROOT/node_modules/.bin/offckb" node >"$NODE_LOG" 2>&1 &
  NODE_PID=$!
  STARTED_NODE=1
  wait_for_rpc
fi

info "Exporting OffCKB devnet system Script information."
"$ROOT/node_modules/.bin/offckb" system-scripts --output "$SYSTEM_SCRIPTS"
[[ -s "$SYSTEM_SCRIPTS" ]] || fail "OffCKB did not generate $SYSTEM_SCRIPTS."
pass "Devnet system Scripts exported."

info "Deriving the issuer Lock Script hash and updating .env."
npm run offckb:configure
bash scripts/check-env.sh

info "Running the complete offline application test suite and credential demo."
npm test
npm run demo

info "Formatting, building, and testing the Rust CKB Type Script."
(
  cd digital-credentials-workspace
  # Apply rustfmt automatically so harmless formatting differences never stop
  # the one-command workflow. The following check proves the tree is clean.
  cargo fmt --all
  cargo fmt --all -- --check

  # Remove artifacts produced with older/incompatible RUSTFLAGS. In particular,
  # the former `-a` flag can leave a failed bytes/molecule build in this target.
  rm -rf target/riscv64imac-unknown-none-elf

  # The contract Makefile uses the official CKB lower-atomic compiler pass:
  #   -C passes=lower-atomic
  # This prevents unsupported RISC-V A-extension instructions from bytes/molecule.
  grep -q 'passes=lower-atomic' contracts/credential-revocation/Makefile \
    || fail "Contract Makefile is missing the required lower-atomic compiler pass."
  # Reject only an actual `-a` entry inside the comma-separated
  # target-feature value. Do not match the unrelated substring in
  # `passes=lower-atomic` or comments that mention the old flag.
  if grep -Eq 'target-feature=[^[:space:]]*,-a(,|[[:space:]]|$)' \
      contracts/credential-revocation/Makefile; then
    fail "Contract Makefile still contains the incompatible RISC-V -a target feature."
  fi

  export TARGET_CC="${TARGET_CC:-riscv64-unknown-elf-gcc}"
  export TARGET_AR="${TARGET_AR:-riscv64-unknown-elf-ar}"
  command -v "$TARGET_CC" >/dev/null || fail "Missing RISC-V C compiler: $TARGET_CC"
  command -v "$TARGET_AR" >/dev/null || fail "Missing RISC-V archiver: $TARGET_AR"
  pass "Using CKB C toolchain: $TARGET_CC / $TARGET_AR"

  make build TARGET_CC="$TARGET_CC" TARGET_AR="$TARGET_AR"
  make test
)
[[ -s "$CONTRACT_BIN" ]] || fail "Contract binary was not produced: $CONTRACT_BIN"
pass "Rust contract built and all positive/negative tests passed."

info "Deploying the Rust contract to local OffCKB without a confirmation prompt."
rm -rf "$DEPLOYMENT_DIR/devnet/credential-revocation" "$DEPLOYMENT_DIR/scripts.json"
PRIVATE_KEY="$(tr -d '\r\n' <"$PRIVATE_KEY_FILE")"
"$ROOT/node_modules/.bin/offckb" deploy \
  --network devnet \
  --target "$CONTRACT_BIN" \
  --output "$DEPLOYMENT_DIR" \
  --privkey "$PRIVATE_KEY" \
  --yes
[[ -s "$DEPLOYMENT_DIR/scripts.json" ]] || fail "Deployment scripts.json is missing."
pass "Contract deployment completed."

info "Running the real on-chain ACTIVE -> REVOKED lifecycle."
LOCAL_CHAIN_CREDENTIAL_ID="$LOCAL_CHAIN_CREDENTIAL_ID" npm run offckb:lifecycle -- "$LOCAL_CHAIN_CREDENTIAL_ID"

info "Checking the final live Cell state from the OffCKB indexer."
FINAL_JSON="$(npm run --silent offckb:verify -- "$LOCAL_CHAIN_CREDENTIAL_ID")"
printf '%s\n' "$FINAL_JSON"
printf '%s' "$FINAL_JSON" | grep -q '"status": "REVOKED"' \
  || fail "Final on-chain state is not REVOKED."
pass "The local chain contains the final REVOKED record for the tested Cell lineage."

if command -v sha256sum >/dev/null; then
  sha256sum "$CONTRACT_BIN" | tee "$ROOT/data/credential-revocation.sha256"
else
  shasum -a 256 "$CONTRACT_BIN" | tee "$ROOT/data/credential-revocation.sha256"
fi

cat <<SUMMARY

============================================================
LOCAL OFFCKB LEVEL-2 RUN COMPLETED SUCCESSFULLY
============================================================
Network:                 local OffCKB devnet only
RPC:                     $RPC_URL
Credential ID:           $LOCAL_CHAIN_CREDENTIAL_ID
Issuer address:          $(grep '^CKB_ISSUER_ADDRESS=' .env | cut -d= -f2-)
Issuer Lock Script hash: $(grep '^ISSUER_LOCK_HASH=' .env | cut -d= -f2-)
Deployment record:       deployment/scripts.json
Lifecycle evidence:      data/offckb-chain-state.json
Contract checksum:       data/credential-revocation.sha256
Node log:                data/logs/offckb-node.log

No testnet or mainnet was used.
The private development key is stored locally in:
  secrets/offckb-issuer-private-key
It is ignored by Git and must never be used with real assets.
============================================================
SUMMARY
