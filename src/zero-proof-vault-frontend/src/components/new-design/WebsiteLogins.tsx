// WebsiteLogins.tsx — entries-only, IDB-backed, no useState for data

import React from "react";
import { Copy, Edit2, Trash2, Plus } from "lucide-react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";
import { ghostkeysStorage } from "../../storage/IDBService.ts";
import { useIdentitySystem } from "../../utility/identity";
import GKFormModal, { GKField } from "./GKFormModal";
import AddSiteModal from "./AddSiteModal";
import { useAPIContext } from "../../utility/api/APIContext.tsx";
import { aesDecrypt, aesEncrypt, deriveFinalKey, deriveSignatureFromPublicKey, generateSeedAndIdentityPrincipal } from "../../utility/crypto/encdcrpt.ts";
import { VaultData } from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";

type Site = {
  name: string;
  entries: Array<{ login: string; password: string }>;
};

function siteIconFor(name: string): string | undefined {
  const n = name.trim().toLowerCase();
  if (n.includes("google")) return "/google.png";
  if (n.includes("github")) return "/github.jpeg";
  if (n === "x" || n.includes("twitter")) return "/twitter.png";
  if (n.includes("aws")) return "/aws.png";
  if (n.includes("facebook")) return "/facebook.png";
  if (n.includes("dropbox")) return "/dropbox.png";
  return undefined;
}

export default function WebsiteLogins(): JSX.Element {
  const [openAddSite, setOpenAddSite] = React.useState(false);
  const [openAddEntryForIdx, setOpenAddEntryForIdx] = React.useState<number | null>(null);
  const { currentProfile } = useIdentitySystem();
  const { getSharedVaultCanisterAPI, getVetKDDerivedKey } = useAPIContext();
  const userId = currentProfile.principal.toString();   // same pattern as SpreadsheetCanvas
  const vaultId = "default";

  // ---- Model (no React state for data) ----
  const modelRef = React.useRef<{ sites: Site[] }>({ sites: [] });

  // force re-render when model changes (like a "draw" in the canvas)
  const [tick, setTick] = React.useState(0);
  const rerender = () => setTick((t) => t + 1);

  // UI-only states
  const [q, setQ] = React.useState("");
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // ---- Load from IDB on mount ----
  React.useEffect(() => {
    (async () => {
      if (!userId) return; // no profile yet → skip (same behavior as SpreadsheetCanvas)
      const sites = await ghostkeysStorage.getWebsiteLogins(userId, vaultId);
      modelRef.current.sites = sites ?? [];
      rerender();
    })();
  }, [userId]);

  // ---- Save helper (like saveSpreadsheetToIDB) ----
  async function saveWebsiteLoginsToIDB() {
    if (!userId) return;
    setSaving(true);
    try {
      await ghostkeysStorage.setWebsiteLogins(userId, vaultId, modelRef.current.sites);
      toast("Saved");
    } finally {
      setSaving(false);
    }
  }

  // ---- Export (JSON) ----
  function exportJson() {
    const blob = new Blob([JSON.stringify(modelRef.current.sites, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "website-logins.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---- Toast ----
  function toast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 1200);
  }

  // ---- Derived (filter on render; data lives in ref) ----
  const filtered: Site[] = React.useMemo(() => {
    const all = modelRef.current.sites;
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
        (s) =>
            s.name.toLowerCase().includes(needle) ||
            s.entries.some((e) => e.login.toLowerCase().includes(needle))
    );
    // depend on tick so recompute after mutations
  }, [q, tick]);

  function renameSite(idx: number) {
    const cur = modelRef.current.sites[idx];
    if (!cur) return;
    const name = prompt("Rename site", cur.name)?.trim();
    if (!name) return;
    const next = modelRef.current.sites.slice();
    next[idx] = { ...next[idx], name };
    modelRef.current.sites = next;
    rerender();
    saveWebsiteLoginsToIDB();
  }

  function deleteSite(idx: number) {
    const cur = modelRef.current.sites[idx];
    if (!cur) return;
    if (!confirm(`Delete “${cur.name}” and all its entries?`)) return;
    const next = modelRef.current.sites.filter((_, i) => i !== idx);
    modelRef.current.sites = next;
    rerender();
    saveWebsiteLoginsToIDB();
  }

  function editEntry(siteIdx: number, entryIdx: number) {
    const next = modelRef.current.sites.slice();
    const site = next[siteIdx];
    const entry = site?.entries?.[entryIdx];
    if (!site || !entry) return;

    const login = prompt("Edit login", entry.login)?.trim();
    if (login == null) return;
    const password = prompt("Edit password (leave blank to keep)", entry.password)?.trim();

    const newEntry = {
      login,
      password: password === "" ? entry.password : (password ?? entry.password),
    };
    const newEntries = site.entries.slice();
    newEntries[entryIdx] = newEntry;

    next[siteIdx] = { ...site, entries: newEntries };
    modelRef.current.sites = next;
    rerender();
    saveWebsiteLoginsToIDB();
  }

  function deleteEntry(siteIdx: number, entryIdx: number) {
    const site = modelRef.current.sites[siteIdx];
    const entry = site?.entries?.[entryIdx];
    if (!site || !entry) return;
    if (!confirm(`Delete entry “${entry.login}” from ${site.name}?`)) return;

    const next = modelRef.current.sites.slice();
    next[siteIdx] = { ...site, entries: site.entries.filter((_, j) => j !== entryIdx) };
    modelRef.current.sites = next;
    rerender();
    saveWebsiteLoginsToIDB();
  }

  async function copyPassword(siteIdx: number, entryIdx: number) {
    const pwd = modelRef.current.sites?.[siteIdx]?.entries?.[entryIdx]?.password ?? "";
    if (!pwd) return;
    try {
      await navigator.clipboard.writeText(pwd);
      toast("Password copied");
    } catch {
      toast("Could not copy");
    }
  }

    // Testing backend canister | THIS IS ONLY FOR TESTING
    const makeCallToEncryptAndSaveDataToVault = async () => {
      console.log("Testing canister calls");
      const vaultId = "frsi7-vo5vn-mww3z-lxgdi-b32pb-oncz2-fetjn-xpxnl-xp7vf-px6xu-uqe";
      console.log('user', userId);
      console.log('vault', vaultId);

      // Keys

      const vetKD = await getVetKDDerivedKey();
      const vaultKD = await deriveSignatureFromPublicKey(vaultId, currentProfile.identity);
      const fnKD = await deriveFinalKey(vaultKD, vetKD);
      

      // Data to encrypt
      const vaultName = await aesEncrypt('Vault1', fnKD);
      const colName = await aesEncrypt("Col1", fnKD);
      const noteName = await aesEncrypt("Secure", fnKD);
      const noteSecret = await aesEncrypt("Note", fnKD);
      const spreadsheetValue = await aesEncrypt("Value", fnKD);
      const websiteName = await aesEncrypt("Google", fnKD);
      const websiteUser = await aesEncrypt('test', fnKD);
      const websitePass = await aesEncrypt('pass', fnKD);

      

      const data: VaultData = {
        'vault_name': vaultName,
        'flexible_grid_columns': [[colName, [1, true]]],
        'secure_notes': [[noteName, noteSecret]],
        'flexible_grid': [[{'col': 1, row: 2}, spreadsheetValue]],
        'website_logins': [[websiteName, [[websiteUser, websitePass]]]],
      };
      console.log('data before', data);
      const sharedActor = await getSharedVaultCanisterAPI();
      const addToShared = await sharedActor.add_or_update_vault(userId, vaultId.toString(), data);
      console.log(addToShared);
      
      const getData = (await sharedActor.get_vault(userId, vaultId))[0];
      console.log("data for user", getData);

      if(getData) {
        const encryptedName = getData.vault_name;
        console.log("encryptedName", encryptedName);
        const decryptedName = await aesDecrypt(encryptedName, fnKD);
        console.log('decryptedName', decryptedName);
      }

    }

  return (
      <section className="website-logins">
        <div className="website-logins-header">
          <div className="title-and-button">
            <img src={"/ghost-white.png"} alt={"logo"} className={"ghost-icon"} />
            <h1>Website Logins {saving ? "· Saving…" : ""}</h1>

            <div className="header-actions">
              <button className="gk-btn gk-btn-add" onClick={() => setOpenAddSite(true)}>
                <Plus size={16} /> Add site
              </button>
              <button className="gk-btn gk-btn-export" onClick={exportJson}>Export</button>
              <button className="gk-btn gk-btn-save" onClick={makeCallToEncryptAndSaveDataToVault}>Save</button>
            </div>
          </div>

          <div className="search-bar">
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by site or login…"
                aria-label="Search logins"
            />
          </div>
        </div>

        <div className="website-logins-grid">
          {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="ghost-float" style={{ fontSize: 64 }}>
                  <img src={funnyGhostIcon} />
                </div>
                <h2 style={{ marginBottom: 24 }}>No logins yet</h2>
                <button className="gk-btn gk-btn-add" onClick={() => setOpenAddSite(true)}>
                  <Plus size={16} /> Add site
                </button>
              </div>
          ) : (
              filtered.map((site, i) => (
                  <article key={`${site.name}-${i}`} className="login-card" aria-label={`${site.name} logins`}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      {siteIconFor(site.name) ? (
                          <img src={siteIconFor(site.name)} alt="" style={{ height: 40, width: 40, borderRadius: 12 }} />
                      ) : (
                          <div style={faviconBoxStyle}><span style={{fontWeight:700}}>{site.name.slice(0,1).toUpperCase()}</span></div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, color: "#fff", fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {site.name}
                        </h3>
                        <p style={{ margin: 0, color: "rgba(255,255,255,.7)", fontSize: 13 }}>
                          {site.entries.length} entr{site.entries.length === 1 ? "y" : "ies"}
                        </p>
                      </div>
                      <button title="Rename site" aria-label="Rename site" style={btnIconStyle} onClick={() => renameSite(i)}>
                        <Edit2 size={18} />
                      </button>
                      <button title="Delete site" aria-label="Delete site" style={btnIconStyle} onClick={() => deleteSite(i)}>
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      {site.entries.length === 0 ? (
                          <div style={{ opacity: 0.8, fontSize: 13 }}>No entries yet.</div>
                      ) : (
                          site.entries.map((e, j) => (
                              <div key={`${e.login}-${j}`} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", alignItems: "center", gap: 8 }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.login}</div>
                                  <div style={{ letterSpacing: 3, opacity: 0.9 }}>
                                    {"•".repeat(Math.max(8, Math.min(e.password.length, 14)))}
                                  </div>
                                </div>
                                <IconButton label="Copy" onClick={() => copyPassword(i, j)}><Copy size={14} /></IconButton>
                                <IconButton label="Edit" onClick={() => editEntry(i, j)}><Edit2 size={14} /></IconButton>
                                <IconButton label="Delete" onClick={() => deleteEntry(i, j)}><Trash2 size={14} /></IconButton>
                              </div>
                          ))
                      )}
                    </div>

                    <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                      <button className="gk-btn gk-btn-add" onClick={() => setOpenAddEntryForIdx(i)}>
                        <Plus size={14} /> Add entry
                      </button>
                    </div>
                  </article>
              ))
          )}
        </div>

        {/* Add Site */}
        <GKFormModal
            open={openAddSite}
            title="Add website"
            description="Group multiple credentials under a single site."
            onClose={() => setOpenAddSite(false)}
            okLabel="Create"
            fields={[
              { name: "site", label: "Website name", placeholder: "e.g. Google", required: true },
            ]}
            onSubmit={({ site }) => {
              modelRef.current.sites = [{ name: site, entries: [] }, ...modelRef.current.sites];
              setOpenAddSite(false);
              rerender();
              saveWebsiteLoginsToIDB();
            }}
        />

        {/* Add Entry */}
        <GKFormModal
            open={openAddEntryForIdx != null}
            title="Add login entry"
            description="Store one username/email + password pair."
            onClose={() => setOpenAddEntryForIdx(null)}
            okLabel="Add"
            fields={[
              { name: "login", label: "Login", placeholder: "username or email", required: true, autoComplete: "username" },
              { name: "password", label: "Password", placeholder: "••••••••", type: "password", required: true, autoComplete: "current-password" },
            ]}
            onSubmit={({ login, password }) => {
              const idx = openAddEntryForIdx!;
              const next = modelRef.current.sites.slice();
              const site = next[idx];
              if (site) {
                next[idx] = { ...site, entries: [{ login, password }, ...site.entries] };
                modelRef.current.sites = next;
                rerender();
                saveWebsiteLoginsToIDB();
              }
              setOpenAddEntryForIdx(null);
            }}
        />

        <AddSiteModal
            open={openAddSite}
            onClose={() => setOpenAddSite(false)}
            onCreate={(siteName) => {
              modelRef.current.sites = [{ name: siteName, entries: [] }, ...modelRef.current.sites];
              rerender();
              saveWebsiteLoginsToIDB();
            }}
        />

        {toastMsg && <div style={toastStyle} role="status" aria-live="polite">{toastMsg}</div>}
      </section>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick?: () => void; children: React.ReactNode }) {
  return (
      <button onClick={onClick} title={label} aria-label={label} style={btnChipStyle}>
        {children}
      </button>
  );
}

// small inline styles
const btnChipStyle: React.CSSProperties = { background:"rgba(255,255,255,0.06)", color:"rgba(255,255,255,0.85)", padding:6, borderRadius:8, border:"none", cursor:"pointer" };
const btnIconStyle: React.CSSProperties = { background:"rgba(255,255,255,.15)", color:"rgba(255,255,255,0.75)", padding:6, borderRadius:999, width:30, height:30, border:"none", cursor:"pointer" };
const faviconBoxStyle: React.CSSProperties = { height:40, width:40, borderRadius:12, background:"rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", color:"rgba(255,255,255,0.85)" };
const toastStyle: React.CSSProperties = { position:"fixed", right:20, bottom:20, background:"rgba(17,24,39,0.9)", color:"#fff", padding:"10px 14px", borderRadius:10, boxShadow:"0 10px 30px rgba(0,0,0,.25)" };
