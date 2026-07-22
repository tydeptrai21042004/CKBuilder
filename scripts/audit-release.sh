#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

pass() {
  printf '[PASS] %s\n' "$1"
}

for forbidden in .env secrets data deployment node_modules; do
  [[ ! -e "$forbidden" ]] || fail "Release contains forbidden generated path: $forbidden"
done

for required in \
  screenshots/01-rust-contract-tests.png \
  screenshots/02-contract-deployment.png \
  screenshots/03-local-offckb-success.png \
  screenshots/SECURITY_REVIEW.md \
  evidence/run-summary.json \
  evidence/local-offckb-run-sanitized.log \
  evidence/v2-node-tests.txt \
  evidence/v2-offline-inspector.txt \
  evidence/v2-inspector-smoke-summary.json \
  evidence/v2.1-node-tests.txt \
  evidence/v2.1-community-conformance.txt \
  evidence/v2.1-http-smoke-summary.json \
  evidence/v2.1-proof-verifier.txt \
  evidence/v2.1-ci-local.txt \
  .env.example \
  .gitignore \
  docs/PUBLIC_INSPECTOR.md \
  docs/CREDENTIAL_CELL_DATA_FORMAT.md \
  docs/NERVOS_TALK_RELEASE_CHECKLIST.md \
  community/README.md \
  community/decoder/credential-cell-decoder.js \
  community/decoder/decoder-manifest.example.json \
  community/schemas/credential-cell-test-vectors-v1.schema.json \
  community/schemas/public-verification-proof-v2.schema.json \
  community/test-vectors/credential-cell-v1.json \
  HANDBOOK_PROGRESS.md \
  CONTRIBUTING.md \
  LICENSE; do
  [[ -f "$required" ]] || fail "Missing evidence file: $required"
done

if grep -RIE --exclude-dir=node_modules --exclude-dir=target --exclude='*.png' --exclude='audit-release.sh' --exclude='v2.1-ci-local.txt' \
  -- '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|(^|[^A-Za-z0-9_])(PRIVATE_KEY|CKB_PRIVATE_KEY|MNEMONIC|SEED_PHRASE)[[:space:]]*=[[:space:]]*(0x[0-9a-fA-F]{64}|[A-Za-z0-9+/=_-]{24,})' .; then
  fail 'Potential private signing material was found.'
fi

if grep -RIE --exclude-dir=node_modules --exclude-dir=target --exclude='*.png' --exclude='v2.1-ci-local.txt' \
  '/mnt/c/Users/18521|tydeptrai@dangbatydeptrai|C:\\Users\\18521|/mnt/data/ckbuilder_work' screenshots evidence; then
  fail 'Unsanitized local username/path found in evidence.'
fi

python3 -m json.tool evidence/run-summary.json >/dev/null
python3 -m json.tool evidence/v2-inspector-smoke-summary.json >/dev/null
python3 -m json.tool evidence/v2.1-http-smoke-summary.json >/dev/null
python3 -m json.tool community/test-vectors/credential-cell-v1.json >/dev/null
python3 -m json.tool community/decoder/decoder-manifest.example.json >/dev/null
python3 -m json.tool community/schemas/credential-cell-test-vectors-v1.schema.json >/dev/null
python3 -m json.tool community/schemas/public-verification-proof-v2.schema.json >/dev/null
node scripts/verify-test-vectors.js >/dev/null
pass 'No generated .env or secrets directory is present.'
pass 'No unapproved private-key, seed-phrase, or mnemonic assignment pattern was found.'
pass 'Evidence paths and usernames are sanitized.'
pass 'Evidence and community test-vector JSON files are valid.'
pass 'Release audit completed successfully.'
