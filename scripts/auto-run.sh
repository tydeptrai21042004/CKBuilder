#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  if [[ "${AUTO_CREATE_ENV:-1}" == "1" ]]; then
    cp .env.example .env
    echo '[INFO] Created .env from .env.example for the local deterministic demo.'
  else
    echo 'ERROR: .env is missing.' >&2
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

bash scripts/check-env.sh
bash scripts/check-toolchain.sh

printf '\n=== JavaScript static syntax checks ===\n'
while IFS= read -r -d '' file; do node --check "$file"; done < <(find src test -name '*.js' -print0)

printf '\n=== JavaScript automated tests ===\n'
npm test

printf '\n=== End-to-end credential demo ===\n'
npm run demo

if [[ "${SKIP_RUST:-0}" != "1" ]]; then
  printf '\n=== Rust automatic formatting and verification ===\n'
  (cd digital-credentials-workspace && cargo fmt --all && cargo fmt --all -- --check)

  printf '\n=== Build CKB RISC-V contract ===\n'
  (cd digital-credentials-workspace && make build TARGET_CC="${TARGET_CC:-riscv64-unknown-elf-gcc}" TARGET_AR="${TARGET_AR:-riscv64-unknown-elf-ar}")

  printf '\n=== CKB contract positive and negative tests ===\n'
  (cd digital-credentials-workspace && make test)

  test -s "$REVOCATION_CONTRACT_BIN" || {
    echo "ERROR: Contract binary missing or empty: $REVOCATION_CONTRACT_BIN" >&2
    exit 1
  }
  sha256sum "$REVOCATION_CONTRACT_BIN"
fi

if [[ "${SKIP_RUST:-0}" == "1" ]]; then
  printf '\nJAVASCRIPT PREVIEW PASSED. FULL CAPSTONE VERIFICATION REQUIRES THE RUST CONTRACT BUILD AND TESTS.\n'
else
  printf '\nALL APPLICATION AND CKB CONTRACT CHECKS PASSED.\n'
fi
