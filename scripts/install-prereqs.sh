#!/usr/bin/env bash
set -euo pipefail
cat <<'TEXT'
Required software for the full local CKB capstone check:

1. Node.js 20+ and npm
2. Rust stable through rustup
3. RISC-V target:
     rustup target add riscv64imac-unknown-none-elf
4. GNU Make and build-essential
5. Bare-metal RISC-V C toolchain (required by ckb-std's default libc helper):
     sudo apt-get install gcc-riscv64-unknown-elf binutils-riscv64-unknown-elf
6. OffCKB is installed locally by npm when the runner starts

External llvm-strip and llvm-objcopy are not required. Cargo performs release
symbol stripping, while ckb-std's small C helper is compiled by the RISC-V GCC
cross-toolchain.

Run everything with:
     bash scripts/local-offckb-all.sh
TEXT
