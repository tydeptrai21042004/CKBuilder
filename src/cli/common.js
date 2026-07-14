import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "../lib/env.js";
import { formatError } from "../lib/errors.js";

export function rootDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
}

export function env() {
  return loadEnv(rootDir());
}

export function loadInputJson(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(absolute)) throw new Error(`Input JSON not found: ${absolute}`);
  return JSON.parse(fs.readFileSync(absolute, "utf8"));
}

export function run(main) {
  Promise.resolve()
    .then(main)
    .catch((error) => {
      console.error(formatError(error));
      process.exitCode = 1;
    });
}
