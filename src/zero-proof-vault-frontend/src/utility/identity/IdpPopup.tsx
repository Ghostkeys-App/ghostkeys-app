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
    const [selectedIndex, setSelectedIndex] = useState(0);

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

    function onCancel() {
        try {
            const msg = { type: "gk:idp:cancel", apiVersion: API_VERSION };
            window.opener?.postMessage(msg, IFM_ORIGIN);
        } finally {
            try { window.close(); } catch { /* ignore */ }
        }
    }

    // Render
    if (!partnerOrigin) {
        return <Center>Invalid request (missing partner origin)</Center>;
    }
    const domain = getDomain(partnerOrigin) || partnerOrigin;
    return (
        <div className="idp-popup-page">
            <div className="main-bg" />
            <div className="idp-card">
                <h3 className="idp-title">Sign-in with Ghostkeys to {domain}</h3>
                <div className="idp-subtitle">Select Identity</div>

                {identities.length > 0 ? (
                    <>
                        {identities.length === 1 ? (
                            <div className="idp-identity-box">
                                {existsMap[0] === false && !checking && (
                                    <div className="idp-note">No active sessions, sign in with new identity:</div>
                                )}
                                <div className="idp-seed">{checking ? "Checking identity…" : shortenSeed(currentProfile.seedPhrase)}</div>
                            </div>
                        ) : (
                            <ul className="idp-list">
                                {identities.map((_id: any, idx: number) => {
                                    const exists = existsMap[idx];
                                    const isSelected = selectedIndex === idx;
                                    return (
                                        <li key={idx} className="idp-list-item">
                                            <button
                                                className={`gk-btn idp-choice ${isSelected ? 'selected' : ''}`}
                                                disabled={busy || checking}
                                                onClick={() => setSelectedIndex(idx)}
                                            >
                                                <span className="idp-label">{checking && exists === undefined ? 'Checking…' : shortenSeed(currentProfile.seedPhrase)}</span>
                                                <span className="idp-cta">{isSelected ? 'Selected' : 'Select'}</span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <div className="idp-actions">
                            <button className="gk-btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
                            <button className="gk-btn primary" onClick={() => onSelectIdentity(selectedIndex)} disabled={busy || checking}>
                                {busy ? 'Signing in…' : 'Sign in'}
                            </button>
                        </div>
                    </>
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
    if (!seed || seed.length <= 12) return seed;
    return `${seed.slice(0, 6)}…${seed.slice(-6)}`;
}

function getDomain(origin: string) {
    try { return new URL(origin).hostname; } catch { return null; }
}
