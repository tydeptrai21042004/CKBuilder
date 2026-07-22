#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/lib/health.sh
source "$ROOT/scripts/lib/health.sh"

URL="${1:-http://${INSPECTOR_HOST:-127.0.0.1}:${INSPECTOR_PORT:-4173}/api/health}"
TIMEOUT_SECONDS="${HEALTH_TIMEOUT_SECONDS:-2}"

payload="$(curl -fsS --max-time "$TIMEOUT_SECONDS" "$URL")" || exit 1
printf '%s\n' "$payload" | health_payload_is_ok || exit 1
printf '%s\n' "$payload"
