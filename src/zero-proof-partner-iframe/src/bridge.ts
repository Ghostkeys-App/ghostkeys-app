type RpcMsg = { id?: string; method?: string; apiVersion?: string; origin?: string; params?: any };

const API_VERSION = "gk-embed/v1";
let parentOrigin: string | null = null;

function post(target: Window, origin: string, payload: any) {
  target.postMessage({ ...payload, apiVersion: API_VERSION }, origin);
}

export function initBridge() {
  window.addEventListener("message", async (ev: MessageEvent) => {
    const msg = ev.data as RpcMsg;
    if (!msg || msg.apiVersion !== API_VERSION) return;

    // accept first hello from any origin, then lock to it
    if (msg.method === "gk_hello") {
      parentOrigin = ev.origin;
      post(window.parent, ev.origin, { method: "gk_ready" });
      return;
    }

    // after hello, enforce origin
    if (!parentOrigin || ev.origin !== parentOrigin) return;

    if (msg.method === "gk_auth") {
      const principal = "aaaaa-aa";           // replace with real principal
      const id_token = "";                    // replace with real short-lived JWT, or maybe not
      const expires_at = Date.now() + 5 * 60_000;

      post(window.parent, ev.origin, { id: msg.id, result: { principal, id_token, expires_at } });
      return;
    }
  });
}
