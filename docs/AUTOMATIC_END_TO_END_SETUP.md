# Automatic end-to-end local setup

The project includes a root launcher designed for a new Linux, WSL2, or macOS development environment:

```bash
bash run-full-project.sh
```

It checks the existing environment first and reuses compatible tools, dependencies, issuer keys, local OffCKB account information, and running services. It installs only missing components.

## What is automatic

The default command performs all of the following:

1. checks for `curl`, Git, unzip, Node.js 20+, npm, Rust, Cargo, Make, a host C compiler, and the bare-metal RISC-V GCC toolchain;
2. installs missing bootstrap packages through `apt-get` on Linux/WSL or Homebrew on macOS;
3. installs Node.js 20 through a pinned nvm release when no compatible Node installation exists;
4. installs Rust through rustup and adds `riscv64imac-unknown-none-elf`;
5. installs the pinned npm dependencies only when they are absent or invalid;
6. creates `.env` from `.env.example` only when `.env` does not exist;
7. starts a local OffCKB devnet or reuses the current local RPC;
8. selects the first prefunded OffCKB development account automatically;
9. stores that local-only private key under the Git-ignored `secrets/` directory;
10. derives the issuer Lock Script hash and updates local configuration;
11. creates an Ed25519 issuer key pair only if one does not already exist;
12. runs the complete JavaScript test suite and deterministic credential demo;
13. formats, builds, and tests the Rust CKB Type Script;
14. deploys the contract without a confirmation prompt;
15. uses the same generated credential ID for the off-chain signed record and on-chain Cell lifecycle;
16. performs the real local `ACTIVE -> REVOKED` Cell lifecycle;
17. confirms that both the off-chain and live on-chain states are `REVOKED`;
18. exports and independently verifies a read-only public proof;
19. starts the read-only Public Credential Inspector;
20. saves service PID files, logs, checksums, deployment metadata, and a launch summary.

No browser wallet, seed phrase, account import, faucet, testnet token, or mainnet asset is required.

## Supported environments

The primary supported environment is Ubuntu or another Debian-based distribution, including Ubuntu under WSL2. macOS is supported when Homebrew is available.

Native Git Bash, MSYS2, and Cygwin are intentionally rejected because the CKB RISC-V build and OffCKB workflow should run inside WSL2 instead.

The launcher may request the Linux or macOS administrator password once when operating-system packages are missing. It does not ask for a wallet password or blockchain seed phrase.

## Commands

Full first run or complete re-verification:

```bash
bash run-full-project.sh
```

Reuse the existing build and deployment and only ensure services are running:

```bash
bash run-full-project.sh --fast
```

Show installed tools and service health:

```bash
bash run-full-project.sh --status
```

Restart project-managed services and repeat the complete workflow:

```bash
bash run-full-project.sh --restart
```

Stop only OffCKB and inspector processes started by this project:

```bash
bash run-full-project.sh --stop
```

Keep the terminal following the inspector log after setup:

```bash
bash run-full-project.sh --foreground
```

Prevent installation and fail when any prerequisite is absent:

```bash
bash run-full-project.sh --no-install
```

Equivalent npm commands are available:

```bash
npm run project:start
npm run project:fast
npm run project:status
npm run project:stop
```

## Generated local files

| File | Purpose |
|---|---|
| `.env` | Local project configuration |
| `secrets/offckb-issuer-private-key` | Prefunded local OffCKB development key |
| `secrets/issuer-ed25519-private.pem` | Local credential issuer signing key |
| `secrets/issuer-ed25519-public.pem` | Public issuer verification key |
| `deployment/scripts.json` | Contract deployment metadata |
| `data/offckb-chain-state.json` | Recorded `ACTIVE -> REVOKED` lifecycle |
| `data/run/offckb.pid` | PID of an OffCKB node started by the launcher |
| `data/run/inspector.pid` | PID of the inspector started by the launcher |
| `data/run/launch-summary.json` | Machine-readable final startup summary |
| `data/automatic-public-verification-proof.json` | Integrated off-chain/on-chain public proof |
| `data/logs/public-proof-export.log` | Proof export and independent verification log |
| `data/logs/offckb-node.log` | Local node log |
| `data/logs/public-inspector.log` | Inspector log |

All private-key and runtime directories are excluded by `.gitignore`.

## Idempotency and environment preservation

The launcher does not overwrite existing issuer keys. It reuses a compatible Node installation, installed npm packages, Rust toolchain, running OffCKB RPC, and current `.env` values where possible. Local network-specific values are updated only to make the automated local devnet run internally consistent.

The launcher never connects to testnet or mainnet. The automatically selected OffCKB key is a known local-development account and must never be used to hold real assets.
