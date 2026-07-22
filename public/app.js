const inspectForm = document.querySelector("#inspect-form");
const statusText = document.querySelector("#status");
const resultPanel = document.querySelector("#result");
const downloadButton = document.querySelector("#download");
const decodeForm = document.querySelector("#decode-form");
const proofForm = document.querySelector("#proof-form");
let latestProof;

function fileAsBase64(file) {
  if (!file) return Promise.resolve(undefined);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1]);
    reader.onerror = () => reject(reader.error ?? new Error("Cannot read document."));
    reader.readAsDataURL(file);
  });
}

function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Cannot read file."));
    reader.readAsText(file);
  });
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const value = await response.json();
  if (!response.ok) {
    const error = new Error(value.message ?? value.error ?? "Request failed.");
    error.payload = value;
    throw error;
  }
  return value;
}

function text(id, value) {
  document.querySelector(id).textContent = value ?? "—";
}

function renderChecks(container, checks) {
  container.replaceChildren();
  for (const check of checks ?? []) {
    const row = document.createElement("div");
    row.className = `check ${check.ok === true ? "pass" : check.ok === false ? "fail" : "skip"}`;
    const name = document.createElement("strong");
    name.textContent = check.name;
    const message = document.createElement("span");
    message.textContent = check.message;
    row.append(name, message);
    container.append(row);
  }
}

function renderProof(proof) {
  latestProof = proof;
  resultPanel.classList.remove("hidden");
  text("#outcome", proof.outcome);
  text("#offchain", proof.offChain.status ?? "NOT_FOUND");
  text("#onchain", proof.onChain.status);
  text("#document-result", proof.offChain.documentVerified ? "MATCH" : "NOT VERIFIED");
  text("#consistency", proof.stateConsistency.consistent === null ? "NOT CHECKED" : proof.stateConsistency.consistent ? "MATCH" : "MISMATCH");

  const history = document.querySelector("#history");
  history.replaceChildren();
  if (!proof.history.steps.length) {
    const item = document.createElement("li");
    item.textContent = "No saved lineage evidence is available for this credential.";
    history.append(item);
  } else {
    for (const step of proof.history.steps) {
      const item = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = step.state;
      const tx = document.createElement("code");
      tx.textContent = step.txHash;
      item.append(title, document.createTextNode(" — "), tx);
      history.append(item);
    }
  }

  renderChecks(document.querySelector("#checks"), proof.offChain.checks);
  document.querySelector("#raw").textContent = JSON.stringify(proof, null, 2);
}

inspectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusText.textContent = "Inspecting public evidence…";
  resultPanel.classList.add("hidden");
  try {
    const file = document.querySelector("#document").files[0];
    const proof = await postJson("/api/inspect", {
      credentialId: document.querySelector("#credential-id").value,
      documentBase64: await fileAsBase64(file),
      skipChain: document.querySelector("#offline").checked
    });
    statusText.textContent = "Inspection complete.";
    renderProof(proof);
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : String(error);
  }
});

downloadButton.addEventListener("click", () => {
  if (!latestProof) return;
  const blob = new Blob([`${JSON.stringify(latestProof, null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${latestProof.credentialId}-verification-proof.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

decodeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#decode-status");
  const output = document.querySelector("#decode-result");
  status.textContent = "Decoding Cell data…";
  output.classList.add("hidden");
  try {
    const result = await postJson("/api/decode-cell", {
      cellData: document.querySelector("#cell-data").value.trim(),
      expectedCredentialHash: document.querySelector("#expected-credential-hash").value.trim() || undefined,
      expectedIssuerLockHash: document.querySelector("#expected-issuer-hash").value.trim() || undefined
    });
    status.textContent = result.canonical ? "Canonical credential Cell data." : "Cell data decoded with validation errors.";
    output.textContent = JSON.stringify(result, null, 2);
    output.classList.remove("hidden");
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    if (error.payload) {
      output.textContent = JSON.stringify(error.payload, null, 2);
      output.classList.remove("hidden");
    }
  }
});

proofForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const status = document.querySelector("#proof-status");
  const container = document.querySelector("#proof-checks");
  status.textContent = "Verifying proof…";
  container.replaceChildren();
  try {
    const file = document.querySelector("#proof-file").files[0];
    const proof = JSON.parse(await readFileText(file));
    const result = await postJson("/api/verify-proof", { proof });
    status.textContent = result.valid ? "Proof structure and digest are valid." : "Proof verification failed.";
    renderChecks(container, result.checks);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
    if (error.payload?.checks) renderChecks(container, error.payload.checks);
  }
});
