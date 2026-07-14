import path from "node:path";
import { LEDGER_SCHEMA } from "./schema.js";
import { readJson, writeJsonAtomic } from "./json.js";

export function ledgerPath(dataDir) {
  return path.join(dataDir, "ledger.json");
}

export function emptyLedger() {
  return {
    schema: LEDGER_SCHEMA,
    credentials: {},
    revocations: {}
  };
}

export function loadLedger(dataDir) {
  const ledger = readJson(ledgerPath(dataDir), emptyLedger());
  if (ledger.schema !== LEDGER_SCHEMA) throw new Error(`Unsupported ledger schema: ${ledger.schema}`);
  return ledger;
}

export function saveLedger(dataDir, ledger) {
  writeJsonAtomic(ledgerPath(dataDir), ledger);
}
