cur_dir = $(dir $(abspath $(firstword $(MAKEFILE_LIST))))
TOP := $(cur_dir)
CUSTOM_RUSTFLAGS := -C debug-assertions
FULL_RUSTFLAGS := -C target-feature=+zba,+zbb,+zbc,+zbs -C passes=lower-atomic $(CUSTOM_RUSTFLAGS)
# ckb-std enables a small C libc helper by default. Use an explicit bare-metal
# RISC-V cross compiler so cc-rs never guesses a missing toolchain.
TARGET_CC ?= riscv64-unknown-elf-gcc
TARGET_AR ?= riscv64-unknown-elf-ar
CARGO_ARGS :=
MODE := release
BUILD_DIR :=
BINARIES := $(notdir $(shell pwd))

ifeq (release,$(MODE))
	MODE_ARGS := --release
endif

# molecule 0.8+ uses the bytes crate, which emits atomic builtins. CKB-VM
# does not support RISC-V A instructions, so the official CKB template
# lowers atomics into non-atomic operations before instruction selection.
# Do not add `-a`: disabling A after Rust has enabled atomic cfg values
# causes LLVM "Cannot select AtomicLoadAdd" failures.
# No external llvm-strip/llvm-objcopy step is required for this pure-Rust
# contract; Cargo strips release symbols through profile.release.
build:
	RUSTFLAGS="$(FULL_RUSTFLAGS)" TARGET_CC="$(TARGET_CC)" TARGET_AR="$(TARGET_AR)" \
		cargo build --target=riscv64imac-unknown-none-elf $(MODE_ARGS) $(CARGO_ARGS)
	@set -eu; \
	if [ "x$(BUILD_DIR)" != "x" ]; then \
		for binary in $(BINARIES); do \
			echo "Copying binary $$binary to build directory"; \
			cp $(TOP)/target/riscv64imac-unknown-none-elf/$(MODE)/$$binary $(TOP)/$(BUILD_DIR); \
		done; \
	fi

check:
	cargo check $(CARGO_ARGS)

fmt:
	cargo fmt $(CARGO_ARGS)

clean:
	cargo clean

.PHONY: build check fmt clean
