const logEl = document.getElementById("log");
const frameEl = document.getElementById("gkFrame");
const btnMount = document.getElementById("btnMount");
const btnInit = document.getElementById("btnInit");
const btnSignIn = document.getElementById("btnSignIn");
const originInput = document.getElementById("origin");
const principalEl = document.getElementById("principal");
const proofBlock = document.getElementById("proofBlock");
const proofEl = document.getElementById("proof");

function log(...args) {
  const line = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  logEl.textContent += line + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}

const qsOrigin = new URLSearchParams(location.search).get("iframe");
originInput.value = qsOrigin || "https://iframe.ghostkeys.app";

let provider = null;

btnMount.onclick = () => {
  const origin = originInput.value.trim().replace(/\/+$/, "");
  if (!origin) return alert("Set IFRAME_ORIGIN first");

  // mount iframe
  frameEl.src = origin;
  log("Mounted iframe:", frameEl.src);

  // enable init
  btnInit.disabled = false;
};

btnInit.onclick = async () => {
  try {
    const origin = originInput.value.trim().replace(/\/+$/, "");
    if (!origin) return alert("Set IFRAME_ORIGIN first");

    const { createGhostKeysProvider } = await import(origin + "/sdk/gk-embed-v1.js");
    provider = createGhostKeysProvider(frameEl, { expectedOrigin: origin });

    log("Calling provider.init()…");
    await provider.init();
    log("✔ provider.init() resolved");
    btnSignIn.disabled = false;
  } catch (e) {
    log("✖ init error:", e?.message || e);
    console.error(e);
  }
};

btnSignIn.onclick = async () => {
  try {
    log("Calling provider.signIn()…");
    const res = await provider.signIn(); // { principal, proof }
    log("✔ signIn() resolved");
    principalEl.textContent = res.principal;
    proofBlock.style.display = "block";
    proofEl.textContent = JSON.stringify(res, null, 2);
  } catch (e) {
    log("✖ signIn error:", e?.message || e);
    console.error(e);
  }
};
