#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { env, run } from "./common.js";

run(() => {
  const config = env();
  for (const entry of ["ledger.json", "credentials", "revocations"]) {
    fs.rmSync(path.join(config.DATA_DIR, entry), { recursive: true, force: true });
  }
  console.log(`Ledger reset: ${config.DATA_DIR}`);
});
