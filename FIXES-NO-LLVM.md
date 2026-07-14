# LLVM requirement correction

The previous runner incorrectly treated the generated CKB template's optional
LLVM post-processing tools as mandatory and required LLVM 16+. Ubuntu 22.04
installs LLVM 14 from its standard repositories, causing the workflow to stop
before the Rust build.

This revision:

- removes the LLVM 16+ preflight check;
- removes external `llvm-objcopy` stripping from the contract Makefile;
- builds the Script as pure Rust for `riscv64imac-unknown-none-elf`;
- enables Cargo release stripping with `strip = "symbols"`;
- keeps `make`, Rust, Cargo, and the CKB RISC-V target as the actual build requirements;
- leaves `find_clang` only as a compatibility helper for future generated code.
