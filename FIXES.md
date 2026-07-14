# Fixes in this package

This revision addresses the exact failure shown by the WSL run.

1. Formatted `contracts/credential-revocation/src/main.rs`.
2. Formatted `tests/src/tests.rs`.
3. Changed the local runner from format-check-only to automatic formatting followed by strict verification.
4. Added the missing `warn()` shell function.
5. Added explicit LLVM tool detection and automatic `llvm` installation on Debian/Ubuntu/WSL.
6. Reused valid `node_modules` on reruns instead of forcing another npm download.
7. Required public npm access only when dependencies actually need installation.
8. Kept automatic removal of lockfiles contaminated with private registry URLs.
9. Re-ran Bash and JavaScript static syntax checks.

Run the complete local workflow with:

```bash
bash scripts/local-offckb-all.sh
```
