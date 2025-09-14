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

        // Compute responsive popup size (desktop only)
        const vw = Math.max(window.innerWidth || 0, 800);
        const vh = Math.max(window.innerHeight || 0, 600);
        const width = Math.max(520, Math.min(900, Math.floor(vw * 0.38)));
        const height = Math.max(420, Math.min(820, Math.floor(vh * 0.62)));

        // Center the popup on the current screen
        const dualScreenLeft = window.screenLeft !== undefined ? window.screenLeft : (window as any).screenX || 0;
        const dualScreenTop = window.screenTop !== undefined ? window.screenTop : (window as any).screenY || 0;
        const outerW = window.outerWidth || vw;
        const outerH = window.outerHeight || vh;
        const left = Math.max(0, dualScreenLeft + Math.floor((outerW - width) / 2));
        const top = Math.max(0, dualScreenTop + Math.floor((outerH - height) / 2));

        const features = [
            `width=${width}`,
            `height=${height}`,
            `left=${left}`,
            `top=${top}`,
            "toolbar=no",
            "location=no",
            "status=no",
            "menubar=no",
            "scrollbars=yes",
            "resizable=yes",
        ].join(",");

        const w = window.open(url, "gk_idp", features);
        // if (!w) return reject(new Error("popup blocked"));

        const allowedOrigin = getOriginFromUrl(base);
        const off = subscribeMessageOnce((ev, d) => {
            if (allowedOrigin && ev.origin !== allowedOrigin) return false;
            return d && (d.type === "gk:idp:result" || d.type === "gk:idp:cancel");
        }, (_ev, d) => {
            try {
                if (d.type === "gk:idp:result") {
                    resolve({ principal: d.principal });
                } else {
                    // User canceled
                    reject(new Error("User canceled"));
                }
            } catch (e) { reject(e); }
            finally { try { w?.close(); } catch { } }
        });

        // Optional timeout if desired in the future
        // setTimeout(() => { off(); reject(new Error("popup timeout")); try { w?.close(); } catch {} }, 5 * 60_000);
    });
}
