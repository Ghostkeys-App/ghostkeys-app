import { useEffect, useMemo, useState } from "react";
import { Principal } from "@dfinity/principal";
import { useIdentitySystem } from "../identity";
import { useAPIContext } from "../api/APIContext";

const API_VERSION = "gk-embed/v1";
const IFM_ORIGIN = "http://umunu-kh777-77774-qaaca-cai.localhost:4943";

function canonicalBytes(partnerOrigin: string, ts: number, nonce: string) {
    const enc = new TextEncoder();
    const domainBind = `gk:${partnerOrigin}:${ts}`;
    const parts = [
        enc.encode("GhostKeys Proof v1"),
        new Uint8Array([0]),
        enc.encode(domainBind),
        new Uint8Array([0]),
        enc.encode(nonce),
    ];
    const total = parts.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of parts) { out.set(a, off); off += a.length; }
    return { bytes: out, domainBind };
}

export function IdpPopup() {
    const params = new URLSearchParams(window.location.search);
    const partnerOrigin = params.get("origin") || "";
    const { currentProfile } = useIdentitySystem();
    const { getFactoryCanisterAPI } = useAPIContext();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const identities = useMemo(() => {
        return [currentProfile];
    }, [currentProfile]);

    useEffect(() => {
        try {
            if (!document.referrer.startsWith(IFM_ORIGIN)) {
                setError("Referrer is not GhostKeys iframe");
            }
        } catch { }
    }, []);

    async function onSelectIdentity(idIndex: number) {
        setBusy(true); setError(null);
        try {
            const id = identities[idIndex];

            const principal = currentProfile.principal.toString();

            const ts = Math.floor(Date.now() / 1000);
            const nonce = crypto.randomUUID();
            const { bytes, domainBind } = canonicalBytes(partnerOrigin, ts, nonce);

            const sig = await currentProfile.identity.sign(bytes.buffer);

            window.opener?.postMessage({
                type: "gk:idp:result",
                apiVersion: API_VERSION,
                principal,
                proof: {
                    algo: "ed25519",
                    sig_b64: b64(sig),
                    ts,
                    nonce,
                    domain_bind: domainBind,
                    message_b64: b64(bytes),
                }
            }, IFM_ORIGIN);

            window.close();
        } catch (e: any) {
            setBusy(false);
            setError(String(e?.message || e));
        }
    }

    // Render
    if (!partnerOrigin) {
        return <Center>Invalid request (missing partner origin)</Center>;
    }
    return (
        <div style={{ fontFamily: "Inter,system-ui", padding: 16, width: 360 }}>
            <h3 style={{ margin: "0 0 8px" }}>Sign in with GhostKeys</h3>
            <div style={{ fontSize: 12, opacity: .75, marginBottom: 12 }}>
                Request from <code>{partnerOrigin}</code>
            </div>

            {/* Identity list */}
            {identities.length > 0 ? (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {identities.map((id: any, idx: number) => (
                        <li key={idx} style={{ marginBottom: 8 }}>
                            <button disabled={busy} onClick={() => onSelectIdentity(idx)}>
                                Use {id.label || `Identity #${idx + 1}`}
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <div style={{ marginBottom: 12 }}>
                    No identities found on this device.
                    {/* You can link to your existing import/create flow here */}
                </div>
            )}
            {error && <div style={{ color: "crimson", marginTop: 8 }}>{error}</div>}
        </div>
    );
}

function b64(arr: ArrayBuffer | Uint8Array) {
    const u8 = arr instanceof Uint8Array ? arr : new Uint8Array(arr);
    let bin = ""; for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
    return btoa(bin);
}

function Center({ children }: { children: any }) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>{children}</div>;
}
