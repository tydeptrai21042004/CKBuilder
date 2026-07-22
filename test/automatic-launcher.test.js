import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import test from "node:test";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const launcher = path.join(root, "run-full-project.sh");
const implementation = path.join(root, "scripts", "setup-and-run-full.sh");
const localRunner = path.join(root, "scripts", "local-offckb-all.sh");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

test("root one-command launcher and stop wrapper are executable", () => {
  for (const relative of ["run-full-project.sh", "stop-full-project.sh", "scripts/setup-and-run-full.sh"]) {
    const stat = fs.statSync(path.join(root, relative));
    assert.ok(stat.mode & 0o100, `${relative} must be executable by its owner`);
  }
});

test("launcher help promises only local automatic account setup", () => {
  const output = execFileSync("bash", [launcher, "--help"], { cwd: root, encoding: "utf8" });
  assert.match(output, /No browser wallet or manual account setup is required/);
  assert.match(output, /prefunded local\s+OffCKB development account/);
  assert.match(output, /Testnet and mainnet are never used/);
});

test("status mode is read-only and succeeds before setup", () => {
  const output = execFileSync("bash", [launcher, "--status"], { cwd: root, encoding: "utf8" });
  assert.match(output, /CKB Degree Proof service status/);
  assert.match(output, /OffCKB RPC:/);
  assert.match(output, /Inspector API:/);
});



test("inspector health parser accepts the pretty JSON returned by the API", () => {
  const helper = path.join(root, "scripts", "lib", "health.sh");
  const command = `source "${helper}"; printf '{\n  "ok": true,\n  "readOnly": true\n}\n' | health_payload_is_ok`;
  execFileSync("bash", ["-lc", command], { cwd: root, stdio: "pipe" });

  const compact = `source "${helper}"; printf '{"ok":true}\n' | health_payload_is_ok`;
  execFileSync("bash", ["-lc", compact], { cwd: root, stdio: "pipe" });

  const unhealthy = `source "${helper}"; printf '{"ok":false}\n' | health_payload_is_ok`;
  assert.throws(() => execFileSync("bash", ["-lc", unhealthy], { cwd: root, stdio: "pipe" }));
});

test("launcher uses the shared whitespace-tolerant health checker", () => {
  const source = read(implementation);
  assert.match(source, /scripts\/check-inspector-health\.sh/);
  assert.doesNotMatch(source, /grep -q '"ok":true'/);
});

test("health checker accepts the actual pretty HTTP response format", async (t) => {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(`${JSON.stringify({ ok: true, readOnly: true }, null, 2)}\n`);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  const checker = path.join(root, "scripts", "check-inspector-health.sh");
  const child = spawn("bash", [checker, `http://127.0.0.1:${address.port}/api/health`], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const [code] = await once(child, "close");
  assert.equal(code, 0, stderr);
  assert.match(stdout, /"ok": true/);
});

test("launcher reuses compatible tools and installs only when missing", () => {
  const source = read(implementation);
  assert.match(source, /if node_supported; then/);
  assert.match(source, /Reusing Node/);
  assert.match(source, /INSTALL_MISSING/);
  assert.match(source, /npm run inspector:serve/);
  assert.match(source, /inspector_ready/);
});


test("automatic launcher forces a loopback-only CKB RPC", () => {
  const source = read(implementation);
  assert.match(source, /LOCAL_CKB_RPC_URL/);
  assert.match(source, /Refusing non-local RPC/);
  assert.match(source, /export APP_NETWORK="devnet"/);
});

test("launcher manages only project-owned services through PID files", () => {
  const source = read(implementation);
  assert.match(source, /data\/run/);
  assert.match(source, /offckb\.pid/);
  assert.match(source, /inspector\.pid/);
  assert.match(source, /External OffCKB processes were not touched/);
});


test("service shutdown verifies process identity before sending signals", () => {
  const source = read(implementation);
  assert.match(source, /ps -p "\$pid" -o command=/);
  assert.match(source, /offckb\) \[\[ "\$command_line" == \*offckb\*node\*/);
  assert.match(source, /inspector\).*public-inspector-server\.js/);
});

test("local chain runner persists its node when requested", () => {
  const source = read(localRunner);
  assert.match(source, /KEEP_OFFCKB_NODE/);
  assert.match(source, /nohup .*offckb.* node/s);
  assert.match(source, /OFFCKB_PID_FILE/);
});

test("automatic wallet setup extracts a local prefunded account and protects the key", () => {
  const source = read(localRunner);
  assert.match(source, /extract_first_account/);
  assert.match(source, /offckb" accounts/);
  assert.match(source, /chmod 600 "\$PRIVATE_KEY_FILE"/);
  assert.match(source, /CKB_ISSUER_ADDRESS/);
});



test("one credential ID is used for both off-chain and on-chain lifecycle steps", () => {
  const source = read(localRunner);
  assert.match(source, /DEMO_CREDENTIAL_ID="\$LOCAL_CHAIN_CREDENTIAL_ID" npm run demo/);
  assert.match(read(path.join(root, "src", "cli", "demo.js")), /process\.env\.DEMO_CREDENTIAL_ID/);
});

test("launcher exports and independently verifies the integrated public proof", () => {
  const source = read(implementation);
  assert.match(source, /automatic-public-verification-proof\.json/);
  assert.match(source, /npm run --silent credential:inspect/);
  assert.match(source, /npm run --silent proof:verify/);
  assert.match(source, /proof\.stateConsistency\?\.consistent !== true/);
  assert.match(source, /proof\.privateKeyRequired !== false/);
});

test("environment files are parsed as data rather than executed as shell code", () => {
  const launcherSource = read(implementation);
  const checkerSource = read(path.join(root, "scripts", "check-env.sh"));
  const autoRunSource = read(path.join(root, "scripts", "auto-run.sh"));
  const example = read(path.join(root, ".env.example"));
  assert.doesNotMatch(launcherSource, /source [^\n]*\.env/);
  assert.doesNotMatch(checkerSource, /source [^\n]*\.env/);
  assert.doesNotMatch(autoRunSource, /source [^\n]*\.env/);
  assert.match(example, /^ISSUER_NAME="Example University"$/m);
});

test("runtime keys, logs, deployment files and PID files remain Git ignored", () => {
  const ignore = read(path.join(root, ".gitignore"));
  assert.match(ignore, /^secrets\/$/m);
  assert.match(ignore, /^data\/$/m);
  assert.match(ignore, /^deployment\/$/m);
  assert.match(ignore, /^\.env$/m);
});
