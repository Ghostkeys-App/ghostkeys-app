const API_VERSION = "gk-embed/v1";
let parentOrigin: string | null = null;

type MsgFilter = {
    method?: string;
    type?: string;
    origin?: string;
    hasId?: boolean;
};

type MsgHandler = (ev: MessageEvent, data: any) => void;

const _subscribers = new Set<{ filter?: MsgFilter | ((ev: MessageEvent, data: any) => boolean), fn: MsgHandler }>();
let _globalListenerAttached = false;

function getOriginFromUrl(url: string | null | undefined) {
    try { return url ? new URL(url).origin : null; } catch { return null; }
}

function ensureGlobalListener() {
    if (_globalListenerAttached) return;
    _globalListenerAttached = true;
    window.addEventListener("message", (ev: MessageEvent) => {
        const data = ev.data || {};
        if (data.apiVersion !== API_VERSION) return;

        for (const sub of _subscribers) {
            try {
                let match = true;
                if (typeof sub.filter === "function") {
                    match = !!sub.filter(ev, data);
                } else if (sub.filter) {
                    const f = sub.filter;
                    if (f.method !== undefined && data.method !== f.method) match = false;
                    if (f.type !== undefined && data.type !== f.type) match = false;
                    if (f.hasId === true && !data.id) match = false;
                    if (f.origin !== undefined && ev.origin !== f.origin) match = false;
                }
                if (match) sub.fn(ev, data);
            } catch { }
        }
    });
}

export function subscribeMessage(filter: MsgFilter | ((ev: MessageEvent, data: any) => boolean), fn: MsgHandler) {
    ensureGlobalListener();
    const sub = { filter, fn } as const;
    _subscribers.add(sub as any);
    return () => { _subscribers.delete(sub as any); };
}

export function subscribeMessageOnce(filter: MsgFilter | ((ev: MessageEvent, data: any) => boolean), fn: MsgHandler) {
    const off = subscribeMessage(filter, (ev, data) => { try { fn(ev, data); } finally { off(); } });
    return off;
}

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
    subscribeMessage({ method: "gk_hello" }, (ev) => {
        parentOrigin = ev.origin; // lock to first parent
        window.parent.postMessage({ method: "gk_ready", apiVersion: API_VERSION }, ev.origin);
    });

    subscribeMessage((ev, msg) => {
        if (!parentOrigin || ev.origin !== parentOrigin) return false;
        return msg.method === "gk_auth";
    }, async (ev, msg) => {
        try {
            const partnerOrigin: string = msg.params?.partnerOrigin ?? ev.origin;
            const idpBase: string | undefined = msg.params?.idpBase;
            const result = await openPopupAndWaitForProof(partnerOrigin, idpBase);
            post(result, ev, msg.id);
        } catch (e: any) {
            post(null, ev, msg.id, String(e?.message || e));
        }
    });
}

function openPopupAndWaitForProof(partnerOrigin: string, overrideBase?: string) {
    return new Promise<any>((resolve, reject) => {
        const q = new URLSearchParams({ origin: partnerOrigin, v: "1" });
        const base = overrideBase || getIdpBase();
        const url = `${base}/idp/popup?${q.toString()}`;

        const w = window.open(url, "gk_idp", "width=550,height=360");
        console.log('w', w);
        // if (!w) return reject(new Error("popup blocked"));

        const allowedOrigin = getOriginFromUrl(base);
        const off = subscribeMessageOnce({ type: "gk:idp:result", origin: allowedOrigin || undefined }, (_ev, d) => {
            try { resolve({ principal: d.principal }); }
            catch (e) { reject(e); }
            finally { try { w?.close(); } catch { } }
        });

        // setTimeout(() => { off(); reject(new Error("popup timeout")); try { w?.close(); } catch {} }, 5 * 60_000);
    });
}
