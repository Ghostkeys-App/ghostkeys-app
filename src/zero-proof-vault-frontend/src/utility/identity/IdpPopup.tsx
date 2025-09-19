import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { indexDBProfile, useIdentitySystem } from "../identity";
import { useAPIContext } from "../api/APIContext";
import { derivePrincipalAndIdentityFromSeed } from "../crypto/encdcrpt";
import { useVaultProviderActions } from "../vault-provider";

const API_VERSION = "gk-embed/v1";
const IFM_ORIGIN = process.env.DFX_NETWORK == "local" ? `http://${process.env.CANISTER_ID_ZERO_PROOF_PARTNER_IFRAME}.localhost:4943` : "https://iframe.ghostkeys.app";

export function IdpPopup() {
    const params = new URLSearchParams(window.location.search);
    const partnerOrigin = params.get("origin") || "";
    const { currentProfile, profiles, addProfileFromSeed } = useIdentitySystem();
    const { userExistsWithVetKD } = useAPIContext();
    const { syncCurrentVaultWithBackend } = useVaultProviderActions();
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    const [seedMode, setSeedMode] = useState(false);
    const [seedInput, setSeedInput] = useState("");
    const [importBusy, setImportBusy] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    const identities = useMemo(() => {
        // Fallback to currentProfile if profiles list is empty for any reason
        if ((profiles || []).length > 0) return profiles;
        return [
            {
                userID: currentProfile?.userID,
                seedPhrase: currentProfile?.seedPhrase,
                active: true,
                commited: !!currentProfile?.commited,
            } as indexDBProfile,
        ];
    }, [profiles, currentProfile]);

    useEffect(() => {
        try {
            if (!document.referrer.startsWith(IFM_ORIGIN)) {
                setError("You haven't been referred properly. Close windown and repeat operation.");
            }
        } catch { }
    }, []);

    // Force dark theme for the popup to match app style
    useEffect(() => {
        document.body.classList.add("dark");
        return () => { document.body.classList.remove("dark"); };
    }, []);

    // Resize popup window to fit content based on identities count/seed mode
    useLayoutEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        // measure after paint
        const rAF = requestAnimationFrame(() => {
            try {
                const rect = el.getBoundingClientRect();
                // Add generous outer margins so the card sits inside the window
                const marginW = 160; // horizontal padding around card
                const marginH = 180; // vertical padding around card

                const screenW = Math.max(window.screen.availWidth || 0, rect.width + marginW + 40);
                const screenH = Math.max(window.screen.availHeight || 0, rect.height + marginH + 60);

                const targetW = Math.ceil(
                    Math.min(
                        Math.max(rect.width + marginW, 640),
                        Math.max(720, Math.min(920, screenW))
                    )
                );
                const targetH = Math.ceil(
                    Math.min(
                        Math.max(rect.height + marginH, 540),
                        Math.max(600, Math.min(960, screenH))
                    )
                );
                window.resizeTo(targetW, targetH);
            } catch { /* ignore */ }
        });
        return () => cancelAnimationFrame(rAF);
    }, [identities.length, seedMode]);

    // Removed ensureIdentityCommitted/markProfileCommitted: syncing vault will commit identity implicitly.

    async function onSelectIdentity(idIndex: number) {
        setBusy(true); setError(null);
        try {
            const profile = identities[idIndex] as indexDBProfile;
            if (!profile) throw new Error("No identity selected");

            // If not saved yet, just sync the current vault which will commit identity implicitly
            if (!profile.commited && profile.userID === currentProfile.userID) {
                try { await syncCurrentVaultWithBackend(); } catch { /* ignore and continue sign-in */ }
            }

            // Post back selected principal
            const { principal } = await derivePrincipalAndIdentityFromSeed(profile.seedPhrase);
            const principalStr = principal.toString();
            const msg = {
                type: "gk:idp:result",
                apiVersion: API_VERSION,
                principal: principalStr,
            };
            window.opener?.postMessage(msg, IFM_ORIGIN);
            try { window.close(); } catch { /* ignore */ }
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

    // Seed helpers
    const seedIs12Words = useMemo(() => seedInput.trim().split(/\s+/).filter(Boolean).length === 12, [seedInput]);

    // Render
    if (!partnerOrigin) {
        return <Center>Invalid request (missing partner origin)</Center>;
    }
    const domain = getDomain(partnerOrigin) || partnerOrigin;
    return (
        <div className="idp-popup-page">
            <div className="main-bg" />
            <div className="idp-card" ref={cardRef}>
                <h3 className="idp-title">Sign-in with Ghostkeys to {domain}</h3>
                <div className="idp-subtitle">Select Identity</div>

                {identities.length > 0 ? (
                    <>
                        <ul className="idp-list">
                            {identities.map((p: indexDBProfile, idx: number) => {
                                const isSelected = selectedIndex === idx;
                                const label = shortenSeed(p.seedPhrase);
                                const status = p.commited ? '' : ' (Auto-generated new Identity. Will sync on Log-In)';
                                return (
                                    <li key={p.userID ?? idx} className="idp-list-item">
                                        <button
                                            className={`gk-btn idp-choice ${isSelected ? 'selected' : ''}`}
                                            disabled={busy || seedMode}
                                            aria-selected={isSelected}
                                            onClick={() => setSelectedIndex(idx)}
                                        >
                                            <span className="idp-left">
                                                <span className="idp-check" aria-hidden>{isSelected ? '✓' : ''}</span>
                                                <span className="idp-label">{label}{status}</span>
                                            </span>
                                            <span className="idp-cta">{isSelected ? 'Selected' : 'Select'}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>

                        {!seedMode && (
                            <div className="idp-actions">
                                <button className="gk-btn ghost" onClick={() => setSeedMode(true)} disabled={busy}>Log in with seed</button>
                                <button className="gk-btn ghost" onClick={onCancel} disabled={busy}>Cancel</button>
                                <button className="gk-btn primary" onClick={() => onSelectIdentity(selectedIndex)} disabled={busy || selectedIndex < 0}>
                                    {busy ? 'Signing in…' : 'Sign in'}
                                </button>
                            </div>
                        )}

                        {seedMode && (
                            <div className="gk-form" style={{ marginTop: 12 }}>
                                <label className="gk-field">
                                    <span>Seed Phrase</span>
                                    <input
                                        placeholder="Enter 12-word seed phrase"
                                        value={seedInput}
                                        onChange={(e) => setSeedInput(e.target.value)}
                                        disabled={importBusy || busy}
                                    />
                                </label>
                                <div className="idp-actions">
                                    <button className="gk-btn ghost" onClick={() => { if (!importBusy) { setSeedMode(false); setSeedInput(""); setError(null); } }} disabled={importBusy}>Back</button>
                                    <button
                                        className="gk-btn primary"
                                        disabled={!seedIs12Words || importBusy}
                                        onClick={async () => {
                                            setImportBusy(true); setError(null);
                                            try {
                                                const { principal } = await derivePrincipalAndIdentityFromSeed(seedInput.trim());
                                                // require that such user exists on backend
                                                const exists = await userExistsWithVetKD(principal.toString());
                                                if (!exists) throw new Error('No account found for this seed');

                                                // prevent duplicates
                                                const uid = `UserID_${principal.toString()}`;
                                                if ((profiles || []).some(p => p.userID === uid)) {
                                                    // If already present, just post back and close
                                                    const msg = { type: "gk:idp:result", apiVersion: API_VERSION, principal: principal.toString() };
                                                    window.opener?.postMessage(msg, IFM_ORIGIN);
                                                    try { window.close(); } catch { }
                                                    return;
                                                }

                                                // Add and switch locally
                                                await addProfileFromSeed(seedInput.trim());

                                                const msg = { type: "gk:idp:result", apiVersion: API_VERSION, principal: principal.toString() };
                                                window.opener?.postMessage(msg, IFM_ORIGIN);
                                                try { window.close(); } catch { }
                                            } catch (e: any) {
                                                setError(String(e?.message || e));
                                            } finally { setImportBusy(false); }
                                        }}
                                    >
                                        {importBusy ? 'Importing…' : 'Import & Sign In'}
                                    </button>
                                </div>
                            </div>
                        )}
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
    if (!seed) return seed;
    const parts = seed.trim().split(/\s+/);
    if (parts.length <= 4) return seed;
    return `${parts.slice(0, 2).join(' ')} … ${parts.slice(-2).join(' ')}`;
}

function getDomain(origin: string) {
    try { return new URL(origin).hostname; } catch { return null; }
}
