# Rust `AtomicLoadAdd` build fix

## Failure addressed

The previous contract Makefile used:

```make
-C target-feature=+zba,+zbb,+zbc,+zbs,-a
```

The `riscv64imac-unknown-none-elf` target exposes atomic capabilities to Rust.
The `bytes` crate (used through Molecule/CKB types) therefore emits atomic
operations. Disabling the A extension only at LLVM instruction selection time
causes this failure:

```text
rustc-LLVM ERROR: Cannot select ... AtomicLoadAdd
```

## Correct CKB build configuration

The official CKB Script Templates repository recommends lowering atomics:

```make
-C target-feature=+zba,+zbb,+zbc,+zbs -C passes=lower-atomic
```

This repository now uses that configuration and removes old RISC-V target
artifacts before rebuilding.

## Run

```bash
bash scripts/local-offckb-all.sh
```

The runner checks that `passes=lower-atomic` is present and rejects any return
of the incompatible `-a` flag.
