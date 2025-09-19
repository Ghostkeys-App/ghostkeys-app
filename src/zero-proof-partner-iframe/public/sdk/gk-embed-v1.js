// ESM: https://iframe.ghostkeys.app/sdk/gk-embed-v1.js
const API_VERSION = "gk-embed/v1";

export function createGhostKeysProvider(iframe, { expectedOrigin } = {}) {
    const targetOrigin = typeof expectedOrigin === "string"
        ? expectedOrigin
        : new URL(iframe.src).origin; // always a string origin

    let ready = false;

    const subscribers = new Set();
    function subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
    function emit(evt) { subscribers.forEach(fn => { try { fn(evt); } catch { /* ignore */ } }); }

    const pending = new Map();

    function listen(ev) {
        const msg = ev.data || {};
        if (ev.origin !== targetOrigin) return;
        if (msg.apiVersion !== API_VERSION) return;

        if (msg.method === "gk_ready") {
            ready = true;
            emit({ type: "ready" });
            return;
        }

        if (msg.id && pending.has(msg.id)) {
            const { resolve, reject, method } = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error) {
                emit({ type: "response", id: msg.id, method, error: msg.error });
                reject(msg.error);
            } else {
                emit({ type: "response", id: msg.id, method, result: msg.result });
                resolve(msg.result);
            }
            return;
        }
    }
    window.addEventListener("message", listen);

    function rpc(method, params, options = {}) {
        const id = crypto.randomUUID();
        iframe.contentWindow.postMessage({ id, method, params, apiVersion: API_VERSION, origin: window.location.origin }, targetOrigin);

        return new Promise((resolve, reject) => {
            let timeoutId = null;
            if (typeof options.timeoutMs === "number" && options.timeoutMs >= 0) {
                timeoutId = setTimeout(() => {
                    if (pending.has(id)) {
                        pending.delete(id);
                        emit({ type: "timeout", id, method });
                        reject(new Error(`timeout: ${method}`));
                    }
                }, options.timeoutMs);
            }

            const abort = () => {
                if (pending.has(id)) {
                    pending.delete(id);
                    if (timeoutId) clearTimeout(timeoutId);
                    emit({ type: "abort", id, method });
                    reject(new DOMException("Aborted", "AbortError"));
                }
            };
            if (options.signal) {
                if (options.signal.aborted) return abort();
                options.signal.addEventListener("abort", abort, { once: true });
            }

            pending.set(id, {
                method,
                resolve: (v) => { if (timeoutId) clearTimeout(timeoutId); resolve(v); },
                reject: (e) => { if (timeoutId) clearTimeout(timeoutId); reject(e); },
            });
        });
    }

    return {
        // Subscribe to provider events: ready | response | timeout | abort
        subscribe,
        // Resolve when iframe signals ready. No timeout.
        init: () => new Promise((resolve) => {
            if (ready) return resolve();
            const off = subscribe((evt) => { if (evt?.type === "ready") { off(); resolve(); } });
            iframe.contentWindow.postMessage({ method: "gk_hello", apiVersion: API_VERSION, origin: window.location.origin }, targetOrigin);
        }),
        // signIn supports an optional per-call timeout.
        signIn: (opts = {}) => rpc("gk_auth", { partnerOrigin: window.location.origin }, { timeoutMs: opts.timeoutMs, signal: opts.signal }),
        // destroy: () => { window.removeEventListener("message", listen); pending.clear(); }
    };
}
