# Nervos Talk release checklist

Use this after the code is pushed publicly and a fresh deployment exists.

## Required links

- public GitHub repository and exact release/commit;
- live inspector, when deployed;
- public testnet transaction hash;
- binary specification;
- deterministic test vectors;
- test output or CI run.

## Minimum technical claims

State only what the current evidence proves:

- read-only verification requires no signer;
- the Type Script preserves issuer ownership within a Cell lineage;
- the accepted state transition is `ACTIVE → REVOKED`;
- duplicate live records are reported as conflicts;
- global uniqueness across independent Cell lineages is not yet enforced.

## One concrete feedback request

Choose one:

- review the binary field layout;
- implement the test vectors in another language;
- review the issuer-scoped uniqueness alternatives;
- test the decoder against a public transaction;
- advise on the appropriate decoder interface for a CKB visualizer.

## Follow-up evidence

Record the issue/post URL and feedback in the weekly GitHub report. Document any code or specification change caused by that feedback.
