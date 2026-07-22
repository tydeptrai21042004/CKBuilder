#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadPublicInspectorEnv } from "../lib/env.js";
import { buildDecoderManifest } from "../lib/decoder-manifest.js";
import { rootDir } from "./common.js";

const output = process.argv[2];
if (!output) {
  console.error("Usage: npm run manifest:export -- <output.json>");
  process.exit(2);
}

try {
  const env = loadPublicInspectorEnv(rootDir());
  const manifest = buildDecoderManifest(env, { includeRpcUrl: process.argv.includes("--include-rpc") });
  const absolute = path.resolve(output);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(absolute);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
