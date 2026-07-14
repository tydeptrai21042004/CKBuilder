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

for forbidden in .env secrets; do
  [[ ! -e "$forbidden" ]] || fail "Release contains forbidden generated path: $forbidden"
done

for required in \
  screenshots/01-rust-contract-tests.png \
  screenshots/02-contract-deployment.png \
  screenshots/03-local-offckb-success.png \
  screenshots/SECURITY_REVIEW.md \
  evidence/run-summary.json \
  evidence/local-offckb-run-sanitized.log; do
  [[ -f "$required" ]] || fail "Missing evidence file: $required"
done

if grep -RIE --exclude-dir=node_modules --exclude-dir=target --exclude='*.png' --exclude='audit-release.sh' \
  -- '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----|(^|[^A-Za-z0-9_])(PRIVATE_KEY|CKB_PRIVATE_KEY|MNEMONIC|SEED_PHRASE)[[:space:]]*=[[:space:]]*(0x[0-9a-fA-F]{64}|[A-Za-z0-9+/=_-]{24,})' .; then
  fail 'Potential private signing material was found.'
fi

if grep -RIE --exclude-dir=node_modules --exclude-dir=target --exclude='*.png' \
  '/mnt/c/Users/18521|tydeptrai@dangbatydeptrai|C:\\Users\\18521' screenshots evidence; then
  fail 'Unsanitized local username/path found in evidence.'
fi

python3 -m json.tool evidence/run-summary.json >/dev/null
pass 'No generated .env or secrets directory is present.'
pass 'No private-key, seed-phrase, or mnemonic pattern was found.'
pass 'Evidence paths and usernames are sanitized.'
pass 'Evidence JSON is valid.'
pass 'Release audit completed successfully.'
