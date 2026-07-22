# Inspector readiness false-negative fix

## Symptom

The inspector printed its URL and read-only status, but the automatic launcher ended with:

```text
[ERROR] Inspector health endpoint did not become ready.
```

## Root cause

`/api/health` returns pretty-printed JSON:

```json
{
  "ok": true
}
```

The v2.1.1 launcher searched only for the exact compact substring `"ok":true`.
The service was healthy, but the textual probe rejected the whitespace after the colon.

## Fix in v2.1.2

- Added `scripts/lib/health.sh` with a whitespace-tolerant JSON health matcher.
- Added `scripts/check-inspector-health.sh` for direct diagnostics.
- Updated the launcher to use the shared checker.
- Added tests for compact JSON, pretty JSON, unhealthy JSON, and a real HTTP response.
- Added direct health-response and log output when startup genuinely fails.

## Check an existing running inspector

```bash
bash scripts/check-inspector-health.sh
```

or:

```bash
npm run inspector:health
```
