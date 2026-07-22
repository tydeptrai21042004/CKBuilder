#!/usr/bin/env bash
# Shared health-response parsing helpers.
# Accepts either compact JSON (`"ok":true`) or pretty JSON (`"ok": true`).

health_payload_is_ok() {
  grep -Eq '"ok"[[:space:]]*:[[:space:]]*true([[:space:]]*[,}]|[[:space:]]*$)'
}
