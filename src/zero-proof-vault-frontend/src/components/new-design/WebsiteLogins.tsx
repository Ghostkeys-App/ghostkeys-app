import React, {useMemo} from "react";
import { Copy, Edit2, Trash2, Plus } from "lucide-react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";
import { useIdentitySystem } from "../../utility/identity";
import GKFormModal from "./GKFormModal";
import AddSiteModal from "./AddSiteModal";
import {useAPIContext} from "../../utility/api/APIContext.tsx";
import {
  FlexGridDataKey,
  VaultData as BEVaultData
} from "../../../../declarations/shared-vault-canister-backend/shared-vault-canister-backend.did";
import {
  useVaultProviderActions,
  useVaultProviderState, VaultData,
  WebsiteLogin,
  WebsiteLoginEntry
} from "../../utility/vault-provider";
import { aesDecrypt, aesEncrypt, deriveFinalKey, deriveSignatureFromPublicKey } from "../../utility/crypto/encdcrpt.ts";

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
  const { currentProfile } = useIdentitySystem();
  const userId = currentProfile.principal.toString();
  const apiContext = useAPIContext();

  const { vaults, currentVault, currentVaultId } = useVaultProviderState();
  const { createVault, deleteVault, switchVault, saveLoginsToIDB, syncCurrentVaultWithBackend } = useVaultProviderActions();
  const { getSharedVaultCanisterAPI, getVetKDDerivedKey } = useAPIContext();

  const websiteLogins: WebsiteLogin[] = currentVault?.data.website_logins || [];
  const synced = useMemo(
      () => currentVault?.synced,
      [currentVault]
  );

  const [openAddSite, setOpenAddSite] = React.useState(false);
  const [openAddEntryForIdx, setOpenAddEntryForIdx] = React.useState<number | null>(null);

  // UI-only states
  const [q, setQ] = React.useState("");
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function saveWebsiteLoginsToIDB(websiteLogins: WebsiteLogin[]) {
    setSaving(true);

    try {
      await saveLoginsToIDB(websiteLogins);
      toast("Saved");
    } finally {
      setSaving(false);
    }
  }

  // // ---- Derived (filter on render; data lives in ref) ----
  // const filtered: Site[] = React.useMemo(() => {
  //   const all = modelRef.current.sites;
  //   const needle = q.trim().toLowerCase();
  //   if (!needle) return all;
  //   return all.filter(
  //       (s) =>
  //           s.name.toLowerCase().includes(needle) ||
  //           s.entries.some((e) => e.login.toLowerCase().includes(needle))
  //   );
  //   // depend on tick so recompute after mutations
  // }, [q, tick]);

  function renameSite(idx: number) {
    const sitesShallow = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[idx];
    if (!site) return;
    const name = prompt("Rename site", site.name)?.trim();
    if (!name) return;

    sitesShallow[idx] = { ...site, name };
    saveWebsiteLoginsToIDB(sitesShallow);
  }

  async function deleteSite(idx: number) {
    const siteToDelete = websiteLogins[idx];

    if (!siteToDelete) return;
    if (!confirm(`Delete “${siteToDelete.name}” and all its entries?`)) return;

    const filteredSites: WebsiteLogin[] = websiteLogins.filter((_, i) => i !== idx);
    saveWebsiteLoginsToIDB(filteredSites);
  }

  function editEntry(siteIdx: number, entryIdx: number) {
    const sitesShallow: WebsiteLogin[] = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[siteIdx];
    const entry = site?.entries?.[entryIdx];

    if (!site || !entry) return;

    const login = prompt("Edit login", entry.login)?.trim();
    if (login == null) return;
    const password = prompt("Edit password (leave blank to keep)", entry.password)?.trim();

    const newEntry: WebsiteLoginEntry = {
      login,
      password: password ?? entry.password,
    };
    const newEntries = site.entries.slice();
    newEntries[entryIdx] = newEntry;

    sitesShallow[siteIdx] = { ...site, entries: newEntries };
    saveWebsiteLoginsToIDB(sitesShallow);
  }

  function deleteEntry(siteIdx: number, entryIdx: number) {
    const sitesShallow: WebsiteLogin[] = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[siteIdx];
    const entry = site?.entries?.[entryIdx];

    if (!site || !entry) return;
    if (!confirm(`Delete entry “${entry.login}” from ${site.name}?`)) return;

    sitesShallow[siteIdx] = { ...site, entries: site.entries.filter((_, j) => j !== entryIdx) };
    saveWebsiteLoginsToIDB(sitesShallow);
  }

  async function copyPassword(siteIdx: number, entryIdx: number) {
    const pwd = websiteLogins?.[siteIdx]?.entries?.[entryIdx]?.password ?? "";
    if (!pwd) return;
    try {
      await navigator.clipboard.writeText(pwd);
      toast("Password copied");
    } catch {
      toast("Could not copy");
    }
  }

  async function sync () {
    await syncCurrentVaultWithBackend();
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(websiteLogins, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "website-logins.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function toast(msg: string) {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 1200);
  }

  // Testing backend canister | THIS IS ONLY FOR TESTING
  const makeCallToEncryptAndSaveDataToVault = async () => {
    console.log("Testing canister calls");
    // const vaultId = "frsi7-vo5vn-mww3z-lxgdi-b32pb-oncz2-fetjn-xpxnl-xp7vf-px6xu-uqe";
    const vaultId = 'hnw7b-wb3el-olaeb-7tct5-kzljq-kx5dx-krvfw-lsfbn-fdjc4-t5bp5-xae';
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

    const data: BEVaultData = {
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

    console.log('deleting vault', vaultId);
    await sharedActor.delete_vault(userId, vaultId);
    const getData2 = (await sharedActor.get_vault(userId, vaultId))[0];
    console.log("data for user", getData2);

    const getData3 = (await sharedActor.get_vault(userId, 'frsi7-vo5vn-mww3z-lxgdi-b32pb-oncz2-fetjn-xpxnl-xp7vf-px6xu-uqe'))[0];
    console.log("data for user", getData3);

    await sharedActor.clear_all_user_vaults(userId);

    const getData4 = (await sharedActor.get_vault(userId, 'frsi7-vo5vn-mww3z-lxgdi-b32pb-oncz2-fetjn-xpxnl-xp7vf-px6xu-uqe'))[0];
    console.log("data for user", getData4);
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
              <button className={`gk-btn gk-btn-save ${!synced ? 'not-synced' : ''}`} onClick={sync}>
                {'Save' + (!synced ? '(not synced changes detected)' : '')}
              </button>
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
          {websiteLogins.length === 0 ? (
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
              websiteLogins.map((site, i) => (
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

        {/*/!* Add Site *!/*/}
        {/*<GKFormModal*/}
        {/*    open={openAddSite}*/}
        {/*    title="Add website"*/}
        {/*    description="Group multiple credentials under a single site."*/}
        {/*    onClose={() => setOpenAddSite(false)}*/}
        {/*    okLabel="Create"*/}
        {/*    fields={[*/}
        {/*      { name: "site", label: "Website name", placeholder: "e.g. Google", required: true },*/}
        {/*    ]}*/}
        {/*    onSubmit={({ site }) => {*/}
        {/*      saveWebsiteLoginsToIDB([{ name: site, entries: [] }, ...websiteLogins]);*/}
        {/*    }}*/}
        {/*/>*/}

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
              const sitesShallow = websiteLogins.slice();
              const site = sitesShallow[idx];
              if (site) {
                sitesShallow[idx] = { ...site, entries: [{ login, password }, ...site.entries] };
                saveWebsiteLoginsToIDB(sitesShallow);
              }
              setOpenAddEntryForIdx(null);
            }}
        />

        <AddSiteModal
            open={openAddSite}
            onClose={() => setOpenAddSite(false)}
            onCreate={(siteName) => {
              saveWebsiteLoginsToIDB([{ name: siteName, entries: [] }, ...websiteLogins]);
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
