# Contributing

Contributions should be small, reproducible, and tied to a concrete CKB developer or learner need.

## Before opening a pull request

```bash
npm ci --no-audit --no-fund
npm run ci:local
```

For Rust contract changes:

```bash
npm run test:rust
```

## Required evidence

A pull request should include:

- the problem being solved;
- tests that fail before and pass after the change;
- commands used to verify the change;
- any protocol or security assumptions;
- documentation changes when output or behaviour changes.

## Protocol changes

Changes to the 75-byte Cell layout require:

1. a new version identifier;
2. updated specification;
3. new deterministic test vectors;
4. backward-compatibility analysis;
5. Rust and JavaScript test updates.

## Security reports

Do not publish private keys, seed phrases, real student records, or exploitable deployment secrets in a public issue. Follow `SECURITY.md`.
