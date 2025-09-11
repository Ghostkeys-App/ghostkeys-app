const API_VERSION = "gk-embed/v1";
let parentOrigin: string | null = null;

function getIdpBase(): string {
    try {
        const isLocal = process.env.DFX_NETWORK == "local";
        if (isLocal) {
            const id = process.env.CANISTER_ID_ZERO_PROOF_VAULT_FRONTEND;
            if (id) return `http://${id}.localhost:4943`;
            return `http://127.0.0.1:4943`;
        }
    } catch { /* ignore */ }
    return `https://ghostkeys.app`;
}

function post(result: any, ev: MessageEvent, id?: string, error?: any) {
    const payload: any = { apiVersion: API_VERSION };
    if (id) payload.id = id;
    if (error) payload.error = error;
    else payload.result = result;
    window.parent.postMessage(payload, ev.origin);
}

export function initBridge() {
    window.addEventListener("message", async (ev: MessageEvent) => {
        const msg = ev.data || {};
        if (msg.apiVersion !== API_VERSION) return;

        if (msg.method === "gk_hello") {
            parentOrigin = ev.origin; // lock to first parent
            window.parent.postMessage({ method: "gk_ready", apiVersion: API_VERSION }, ev.origin);
            return;
        }
        if (!parentOrigin || ev.origin !== parentOrigin) return;

        if (msg.method === "gk_auth") {
            try {
                const partnerOrigin: string = msg.params?.partnerOrigin ?? ev.origin;
                const idpBase: string | undefined = msg.params?.idpBase; // optional override from SDK
                const result = await openPopupAndWaitForProof(partnerOrigin, idpBase);
                post(result, ev, msg.id);
            } catch (e: any) {
                post(null, ev, msg.id, String(e?.message || e));
            }
        }
    });
}

function openPopupAndWaitForProof(partnerOrigin: string, overrideBase?: string) {
    return new Promise<any>((resolve, reject) => {
        const q = new URLSearchParams({ origin: partnerOrigin, v: "1" });
        const base = overrideBase || getIdpBase();
        const url = `${base}/idp/popup?${q.toString()}`;

        const w = window.open(url, "gk_idp", "width=420,height=640");
        console.log('w', w);
        // if (!w) return reject(new Error("popup blocked"));

        const allowedOrigin = (() => { try { return new URL(base).origin; } catch { return null; } })();
        const onMsg = (ev: MessageEvent) => {
            if (allowedOrigin && ev.origin !== allowedOrigin) return;
            const d = ev.data || {};
            if (d.apiVersion !== API_VERSION || d.type !== "gk:idp:result") return;
            window.removeEventListener("message", onMsg);
            try { resolve({ principal: d.principal, proof: d.proof }); }
            catch (e) { reject(e); }
            try { w?.close(); } catch { }
        };
        window.addEventListener("message", onMsg);
    });
}
