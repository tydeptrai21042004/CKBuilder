# RISC-V C cross-compiler fix

`ckb-std 0.17.2` enables its `libc` feature by default and compiles a small C
helper during a RISC-V contract build. A host-only compiler such as `/usr/bin/cc`
is not sufficient.

This repository now:

- installs `gcc-riscv64-unknown-elf` and `binutils-riscv64-unknown-elf` on Ubuntu/WSL;
- sets `TARGET_CC=riscv64-unknown-elf-gcc`;
- sets `TARGET_AR=riscv64-unknown-elf-ar`;
- passes both variables explicitly to Cargo; and
- verifies both tools before building.

The `lower-atomic` Rust pass remains enabled for Molecule/bytes compatibility.
