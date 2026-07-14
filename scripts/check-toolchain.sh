#!/usr/bin/env bash
set -euo pipefail

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
pass() { printf '[PASS] %s\n' "$*"; }
warn() { printf '[WARN] %s\n' "$*"; }

for command in node npm bash make; do
  command -v "$command" >/dev/null || fail "Missing required command: $command"
  pass "Found $command: $(command -v "$command")"
done

if [[ "${SKIP_RUST:-0}" == "1" ]]; then
  warn "SKIP_RUST=1: Rust build and on-chain contract tests will be skipped. This is not a full Level-2 verification."
  exit 0
fi

if [[ -f "$HOME/.cargo/env" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.cargo/env"
fi

for command in rustup rustc cargo; do
  command -v "$command" >/dev/null || fail "Missing $command. Install the Rust stable toolchain before full verification."
  pass "Found $command: $(command -v "$command")"
done

rustup target list --installed | grep -qx 'riscv64imac-unknown-none-elf' \
  || fail "Missing Rust target riscv64imac-unknown-none-elf. Run: rustup target add riscv64imac-unknown-none-elf"
pass "CKB RISC-V Rust target is installed."

if command -v cc >/dev/null; then
  pass "Host C compiler is available: $(command -v cc)"
else
  fail "No host C compiler found. Install build-essential."
fi

for command in riscv64-unknown-elf-gcc riscv64-unknown-elf-ar; do
  command -v "$command" >/dev/null || fail "Missing $command. On Ubuntu/WSL run: sudo apt-get install gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf"
  pass "Found $command: $(command -v "$command")"
done

pass "External LLVM strip/objcopy tools are not required; ckb-std C helpers use the RISC-V GNU cross-toolchain."
