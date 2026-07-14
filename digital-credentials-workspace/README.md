# Digital Credentials CKB Script Workspace

This workspace contains the `credential-revocation` CKB Type Script and `ckb-testtool` integration tests.

```bash
rustup target add riscv64imac-unknown-none-elf
make build
make test
```

The contract is intentionally small and auditable. It does not mint the academic credential itself; the application signs and records credential metadata, while this Type Script protects the irreversible revocation state transition.
