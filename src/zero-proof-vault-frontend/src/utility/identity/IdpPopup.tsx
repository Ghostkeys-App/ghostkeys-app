import { useEffect, useMemo, useState } from "react";
import { useIdentitySystem } from "../identity";
import { useAPIContext } from "../api/APIContext";

const API_VERSION = "gk-embed/v1";
const IFM_ORIGIN = process.env.DFX_NETWORK == "local" ? `http://${process.env.CANISTER_ID_ZERO_PROOF_PARTNER_IFRAME}.localhost:4943` : "https://iframe.ghostkeys.app";

export function IdpPopup() {
    const params = new URLSearchParams(window.location.search);
    const partnerOrigin = params.get("origin") || "";
    const { currentProfile } = useIdentitySystem();
    const { getFactoryCanisterAPI } = useAPIContext();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [existsMap, setExistsMap] = useState<boolean[]>([]);
    const [checking, setChecking] = useState(true);

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

    // Force dark theme for the popup to match app style
    useEffect(() => {
        document.body.classList.add("dark");
        return () => { document.body.classList.remove("dark"); };
    }, []);

    // Check if user exists in the factory canister for the current identity
    useEffect(() => {
        let cancelled = false;
        setChecking(true);
        (async () => {
            try {
                const api = await getFactoryCanisterAPI();
                const exists = await api.user_caller_exists();
                if (!cancelled) setExistsMap([exists]);
            } catch (e) {
                if (!cancelled) setExistsMap([false]);
            } finally {
                if (!cancelled) setChecking(false);
            }
        })();
        return () => { cancelled = true; };
    }, [getFactoryCanisterAPI, currentProfile]);

    async function onSelectIdentity(idIndex: number) {
        setBusy(true); setError(null);
        try {
            const id = identities[idIndex];

            const principal = currentProfile.principal.toString();
            const msg = {
                type: "gk:idp:result",
                apiVersion: API_VERSION,
                principal,
            };
            window.opener?.postMessage(msg, IFM_ORIGIN);

            // window.close();
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
        <div className="idp-popup-page">
            <div className="main-bg" />
            <div className="idp-card">
                <h3 className="idp-title">Sign in with GhostKeys</h3>
                <div className="idp-origin">Request from <span className="idp-origin-pill">{partnerOrigin}</span></div>

                {identities.length > 0 ? (
                    <ul className="idp-list">
                        {identities.map((id: any, idx: number) => {
                            const exists = existsMap[idx];
                            const label = exists === undefined && checking
                                ? "Checking identity…"
                                : exists
                                    ? shortenSeed(currentProfile.seedPhrase)
                                    : `Use new identity to sign-in with - ${shortenSeed(currentProfile.seedPhrase)}`;
                            return (
                                <li key={idx} className="idp-list-item">
                                    <button
                                        className="gk-btn idp-choice"
                                        disabled={busy || checking}
                                        onClick={() => onSelectIdentity(idx)}
                                    >
                                        <span className="idp-label">{label}</span>
                                        <span className="idp-cta">{busy ? "Working…" : "Select"}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <div className="idp-empty">No identities found on this device.</div>
                )}

                {error && <div className="idp-error">{error}</div>}
            </div>
        </div>
    );
}

function Center({ children }: { children: any }) {
    return <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>{children}</div>;
}

function shortenSeed(seed: string) {
    if (!seed || seed.length <= 8) return seed;
    return `${seed.slice(0, 4)}...${seed.slice(-4)}`;
}
