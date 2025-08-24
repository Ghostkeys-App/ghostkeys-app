import React, {useMemo} from "react";
import { Copy, Edit2, Trash2, Plus } from "lucide-react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";
import GKFormModal from "../new-design/GKFormModal.tsx";
import AddSiteModal from "../new-design/AddSiteModal.tsx";
import {
  useVaultProviderActions,
  useVaultProviderState,
  WebsiteLogin,
  WebsiteLoginEntry
} from "../../utility/vault-provider";
import {copyPassword, exportJson, IconButton, siteIconFor} from "./helpers.ts";
import {toast} from "../../utility/toast";


export default function WebsiteLogins(): JSX.Element {
  const { currentVault } = useVaultProviderState();
  const { saveCurrentVaultDataToIDB, syncCurrentVaultWithBackend, getICVault } = useVaultProviderActions();

  // UI-only states
  const [q, setQ] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [openAddSite, setOpenAddSite] = React.useState(false);
  const [openAddEntryForIdx, setOpenAddEntryForIdx] = React.useState<number | null>(null);

  // Derived values
  const websiteLogins: WebsiteLogin[] = currentVault?.data.website_logins || [];

  const filtered: WebsiteLogin[] = React.useMemo(() => {
    const all = currentVault?.data.website_logins || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((s) =>
        s.name.toLowerCase().includes(needle) ||
        s.entries.some((e) => e.login.toLowerCase().includes(needle))
    );
  }, [q]);

  const synced = useMemo(
      () => currentVault?.synced,
      [currentVault]
  );

  // TEMP FOR TEST
  async function zxc() {
    const a = await getICVault(currentVault!.icpPublicAddress!);
    console.log('GET: ', currentVault!.icpPublicAddress!, a)
  }


  async function onAddEntry(login: string, password: string) {
    const idx = openAddEntryForIdx!;
    const sitesShallow = websiteLogins.slice();
    const site = sitesShallow[idx];
    if (!site) {
      toast.error('Could not add the website entry');
      return;
    }

    sitesShallow[idx] = { ...site, entries: [{login, password}, ...site.entries] };
    await saveWebsiteLoginsToIDB(sitesShallow);
    setOpenAddEntryForIdx(null);
    toast.success('Successfully added the entry');
  }

  async function onAddSite(siteName: string) {
    await saveWebsiteLoginsToIDB([{ name: siteName, entries: [] }, ...websiteLogins]);
  }

  async function saveWebsiteLoginsToIDB(website_logins: WebsiteLogin[]) {
    if (!currentVault) {return}
    await saveCurrentVaultDataToIDB({...currentVault.data, website_logins});
  }

  async function sync () {
    setSaving(true);

    try {
      await syncCurrentVaultWithBackend();
      console.log('Success!!!!!!!!!!!!')
      toast.success('Successfully synced!');
    } catch (err) {
      toast.error('Could not sync with the ICP');
    } finally {
      setSaving(false);
    }
  }

  async function renameSite(idx: number) {
    const sitesShallow = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[idx];
    if (!site) {
      toast.error('Could not rename the website');
      return;
    }

    const name = prompt("Rename site", site.name)?.trim();
    if (!name) return;

    sitesShallow[idx] = { ...site, name };
    await saveWebsiteLoginsToIDB(sitesShallow);
    toast.success('Successfully renamed');
  }

  async function deleteSite(idx: number) {
    const siteToDelete = websiteLogins[idx];

    if (!siteToDelete) {
      toast.error('Could not delete the website');
      return;
    }
    if (!confirm(`Delete “${siteToDelete.name}” and all its entries?`)) return;

    const filteredSites: WebsiteLogin[] = websiteLogins.filter((_, i) => i !== idx);
    await saveWebsiteLoginsToIDB(filteredSites);
    toast.success('Successfully deleted');
  }

  async function editEntry(siteIdx: number, entryIdx: number) {
    const sitesShallow: WebsiteLogin[] = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[siteIdx];
    const entry = site?.entries?.[entryIdx];

    if (!site || !entry) {
      toast.error('Could not edit the website');
      return;
    }

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
    await saveWebsiteLoginsToIDB(sitesShallow);
    toast.success('Successfully deleted');
  }

  async function deleteEntry(siteIdx: number, entryIdx: number) {
    const sitesShallow: WebsiteLogin[] = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[siteIdx];
    const entry = site?.entries?.[entryIdx];

    if (!site || !entry) {
      toast.error('Could not delete the website entry');
      return;
    }
    if (!confirm(`Delete entry “${entry.login}” from ${site.name}?`)) return;

    sitesShallow[siteIdx] = { ...site, entries: site.entries.filter((_, j) => j !== entryIdx) };
    await saveWebsiteLoginsToIDB(sitesShallow);
    toast.success('Successfully deleted');
  }



  return (
      <section className={`website-logins ${saving ? 'saving' : ''}`}>
        <div className="website-logins-header">
          <div className="title-and-button">
            <img src={"/ghost-white.png"} alt={"logo"} className={"ghost-icon"} />
            <h1>Website Logins</h1>

            <div className="header-actions">
              <button className="gk-btn gk-btn-add" onClick={() => setOpenAddSite(true)}>
                <Plus size={16} /> Add site
              </button>
              <button className="gk-btn gk-btn-export" onClick={() => zxc()}>Export</button>
              <button className={`gk-btn gk-btn-save ${synced ? 'synced' : 'not-synced'}`} onClick={sync}>
                {(synced ? 'Synced' : 'Sync changes')}
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
          {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="ghost-float">
                  <img src={funnyGhostIcon} alt={'funny-ghost'} />
                </div>
                <div className={"empty-state-title"}>No logins yet</div>
                <button className="gk-btn gk-btn-add" onClick={() => setOpenAddSite(true)}>
                  <Plus size={16} /> Add site
                </button>
              </div>
          ) : (
              filtered.map((site, i) => (
                  <article key={`${site.name}-${i}`} className="login-card">
                    <div className={"login-card-content"}>
                      {siteIconFor(site.name) ? (
                          <img className={"login-card-icon"} src={siteIconFor(site.name)} alt="predefined-site-icon"/>
                      ) : (
                          <div className={"login-card-icon-box"}>
                            <span>{site.name.slice(0,1).toUpperCase()}</span>
                          </div>
                      )}
                      <div className={"login-card-info"}>
                        <h3>{site.name}</h3>
                        <p>{site.entries.length} entr{site.entries.length === 1 ? "y" : "ies"}</p>
                      </div>
                      <button title="Rename site" aria-label="Rename site" onClick={() => renameSite(i)}>
                        <Edit2 size={18} />
                      </button>
                      <button title="Delete site" aria-label="Delete site" onClick={() => deleteSite(i)}>
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className={"login-card-grid"}>
                      {site.entries.length === 0 ? (
                          <div className={"login-card-grid-placeholder"}>No entries yet.</div>
                      ) : (
                          site.entries.map((e, j) => (
                              <div className={"login-card-entry"}>
                                <div className={"login-card-entry-content"}>
                                  <div className={"login-card-entry-login"}>{e.login}</div>
                                  <div className={"login-card-entry-password"}>
                                    {"•".repeat(Math.max(8, Math.min(e.password.length, 14)))}
                                  </div>
                                </div>
                                <IconButton onClick={() => copyPassword(e.password)}><Copy size={14} /></IconButton>
                                <IconButton onClick={() => editEntry(i, j)}><Edit2 size={14} /></IconButton>
                                <IconButton onClick={() => deleteEntry(i, j)}><Trash2 size={14} /></IconButton>
                              </div>
                          ))
                      )}
                    </div>

                    <div className={"login-card-add-button"}>
                      <button className="gk-btn gk-btn-add" onClick={() => setOpenAddEntryForIdx(i)}>
                        <Plus size={14} /> Add entry
                      </button>
                    </div>
                  </article>
              ))
          )}
        </div>

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
            onSubmit={({login, password}) => onAddEntry(login, password)}
        />

        <AddSiteModal
            open={openAddSite}
            onClose={() => setOpenAddSite(false)}
            onCreate={onAddSite}
        />
      </section>
  );
}
