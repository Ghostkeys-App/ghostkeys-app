import React, { useMemo } from "react";
import { Copy, Edit2, Trash2, Plus } from "lucide-react";
import funnyGhostIcon from "../../../public/funny-ghost.svg";
import GKFormModal from "../../components/modals/gk-form-modal/GKFormModal.tsx";
import AddSiteModal from "./AddSiteModal.tsx";
import {
  useVaultProviderActions,
  useVaultProviderState,
  WebsiteLogin,
  WebsiteLoginEntry
} from "../../utility/vault-provider";
import { exportJson, IconButton, siteIconFor } from "./helpers.tsx";
import { toast } from "../../utility/toast";
import { copyToClipboard } from "../../utility/clipboard";
import GKModal from "../../components/modals/gk-modal/GKModal.tsx";


export default function WebsiteLogins(): JSX.Element {
  const { currentVault } = useVaultProviderState();
  const { saveCurrentVaultDataToIDB, syncCurrentVaultWithBackend } = useVaultProviderActions();

  // UI-only states
  const [q, setQ] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [openAddSite, setOpenAddSite] = React.useState(false);
  const [openAddEntryForIdx, setOpenAddEntryForIdx] = React.useState<number | null>(null);
  const [openRenameSiteIdx, setOpenRenameSiteIdx] = React.useState<number | null>(null);
  const [openEditEntry, setOpenEditEntry] = React.useState<{ siteIdx: number; entryIdx: number } | null>(null);
  const [deleteSiteIdx, setDeleteSiteIdx] = React.useState<number | null>(null);
  const [deleteEntry, setDeleteEntry] = React.useState<{ siteIdx: number; entryIdx: number } | null>(null);

  // Derived values
  const websiteLogins: WebsiteLogin[] = useMemo(
    () => currentVault?.data.website_logins || [],
    [currentVault]
  );

  const filteredWebsiteLogins: WebsiteLogin[] = React.useMemo(() => {
    const all = currentVault?.data.website_logins || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((s) =>
      s.name.toLowerCase().includes(needle) ||
      s.entries.some((e) => e.login.toLowerCase().includes(needle))
    );
  }, [q, currentVault]);

  const synced = useMemo(
    () => currentVault?.synced,
    [currentVault]
  );


  // TEMP FOR TEST
  // async function zxc() {
  //   const a = await getICVault(currentVault!.icpPublicAddress!);
  //   console.log('GET: ', currentVault!.icpPublicAddress!, a)
  // }


  async function onAddEntry(login: string, password: string) {
    const idx = openAddEntryForIdx!;
    const sitesShallow = websiteLogins.slice();
    const site = sitesShallow[idx];
    if (!site) {
      toast.error('Could not add the website entry');
      return;
    }

    sitesShallow[idx] = { ...site, entries: [{ login, password }, ...site.entries] };
    await saveWebsiteLoginsToIDB(sitesShallow);
    setOpenAddEntryForIdx(null);
    toast.success('Successfully added the entry');
  }

  async function onAddSite(siteName: string) {
    await saveWebsiteLoginsToIDB([{ name: siteName, entries: [] }, ...websiteLogins]);
  }

  async function saveWebsiteLoginsToIDB(website_logins: WebsiteLogin[]) {
    if (!currentVault) { return }
    await saveCurrentVaultDataToIDB({ ...currentVault.data, website_logins });
  }

  async function sync() {
    setSaving(true);

    try {
      await syncCurrentVaultWithBackend();
      toast.success('Successfully synced!');
    } catch (err) {
      toast.error('Could not sync with the ICP');
    } finally {
      setSaving(false);
    }
  }

  async function submitRenameSite(newName: string) {
    if (openRenameSiteIdx == null) return;
    const idx = openRenameSiteIdx;
    const sitesShallow = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[idx];
    if (!site) {
      toast.error('Could not rename the website');
      return;
    }

    const name = newName.trim();
    if (!name) return;

    sitesShallow[idx] = { ...site, name };
    await saveWebsiteLoginsToIDB(sitesShallow);
    setOpenRenameSiteIdx(null);
    toast.success('Successfully renamed');
  }

  async function confirmDeleteSite() {
    if (deleteSiteIdx == null) return;
    const idx = deleteSiteIdx;
    const target = websiteLogins[idx];
    if (!target) {
      toast.error("Could not delete the website");
      return;
    }

    const filtered = websiteLogins.filter((_, i) => i !== idx);
    await saveWebsiteLoginsToIDB(filtered);
    setDeleteSiteIdx(null);
    toast.success("Successfully deleted");
  }

  async function submitEditEntry(login: string, password: string) {
    if (!openEditEntry) return;
    const { siteIdx, entryIdx } = openEditEntry;

    const sitesShallow: WebsiteLogin[] = websiteLogins.slice();
    const site: WebsiteLogin | undefined = sitesShallow[siteIdx];
    const entry = site?.entries?.[entryIdx];

    if (!site || !entry) {
      toast.error('Could not edit the website entry');
      return;
    }

    const newLogin = login.trim();
    if (!newLogin) {
      toast.error('Login cannot be empty');
      return;
    }

    const newEntry: WebsiteLoginEntry = {
      login: newLogin,
      password: password,
    };

    const newEntries = site.entries.slice();
    newEntries[entryIdx] = newEntry;

    sitesShallow[siteIdx] = { ...site, entries: newEntries };
    await saveWebsiteLoginsToIDB(sitesShallow);
    setOpenEditEntry(null);
    toast.success('Successfully updated');
  }

  async function confirmDeleteEntry() {
    if (!deleteEntry) return;
    const { siteIdx, entryIdx } = deleteEntry;

    const sites = websiteLogins.slice();
    const site = sites[siteIdx];
    const entry = site?.entries?.[entryIdx];

    if (!site || !entry) {
      toast.error("Could not delete the website entry");
      return;
    }

    sites[siteIdx] = {
      ...site,
      entries: site.entries.filter((_, j) => j !== entryIdx),
    };

    await saveWebsiteLoginsToIDB(sites);
    setDeleteEntry(null);
    toast.success("Successfully deleted");
  }

  // Helpers for modal defaults
  const renameDefaultName = openRenameSiteIdx != null
    ? (websiteLogins[openRenameSiteIdx]?.name ?? "")
    : "";

  const editDefaults = openEditEntry
    ? (websiteLogins[openEditEntry.siteIdx]?.entries[openEditEntry.entryIdx])
    : undefined;

  const editSiteName = openEditEntry
    ? (websiteLogins[openEditEntry.siteIdx]?.name ?? "")
    : "";

  const deleteSiteName =
    deleteSiteIdx != null ? (websiteLogins[deleteSiteIdx]?.name ?? "") : "";

  const deleteEntryMeta = deleteEntry
    ? {
      siteName: websiteLogins[deleteEntry.siteIdx]?.name ?? "",
      entryLogin: websiteLogins[deleteEntry.siteIdx]?.entries[deleteEntry.entryIdx]?.login ?? "",
    }
    : undefined;

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
            <button className="gk-btn gk-btn-export" onClick={() => exportJson(filteredWebsiteLogins)}>Export</button>
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
        {filteredWebsiteLogins.length === 0 ? (
          <div className="empty-state">
            <div className="ghost-float"><img src={funnyGhostIcon} alt={'funny-ghost'} /></div>
            <div className={"empty-state-title"}>No logins yet</div>
            <button className="gk-btn gk-btn-add" onClick={() => setOpenAddSite(true)}>
              <Plus size={16} /> Add site
            </button>
          </div>
        ) : (
          filteredWebsiteLogins.map((site, i) => (
            <article key={`${site.name}-${i}`} className="login-card">
              <div className={"login-card-content"}>
                {siteIconFor(site.name) ? (
                  <img className={"login-card-icon"} src={siteIconFor(site.name)} alt="predefined-site-icon" />
                ) : (
                  <div className={"login-card-icon-box"}>
                    <span>{site.name.slice(0, 1).toUpperCase()}</span>
                  </div>
                )}
                <div className={"login-card-info"}>
                  <h3>{site.name}</h3>
                  <p>{site.entries.length} entr{site.entries.length === 1 ? "y" : "ies"}</p>
                </div>
                <button title="Rename site" aria-label="Rename site" onClick={() => setOpenRenameSiteIdx(i)}>
                  <Edit2 size={18} />
                </button>
                <button title="Delete site" aria-label="Delete site" onClick={() => setDeleteSiteIdx(i)}>
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
                      <IconButton onClick={() => copyToClipboard(e.password)}><Copy size={14} /></IconButton>
                      <IconButton onClick={() => setOpenEditEntry({ siteIdx: i, entryIdx: j })}><Edit2 size={14} /></IconButton>
                      <IconButton onClick={() => setDeleteEntry({ siteIdx: i, entryIdx: j })}><Trash2 size={14} /></IconButton>
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
        onSubmit={({ login, password }) => onAddEntry(login, password)}
      />

      <AddSiteModal
        open={openAddSite}
        onClose={() => setOpenAddSite(false)}
        onCreate={onAddSite}
      />

      <GKFormModal
        open={openRenameSiteIdx != null}
        title="Rename site"
        description="Update the site name."
        onClose={() => setOpenRenameSiteIdx(null)}
        okLabel="Rename"
        fields={[
          { name: "name", label: "Site name", required: true, defaultValue: renameDefaultName, placeholder: "e.g. Google" },
        ]}
        onSubmit={({ name }) => submitRenameSite(name)}
      />

      <GKFormModal
        open={openEditEntry != null}
        title={editSiteName ? `Edit entry – ${editSiteName}` : "Edit entry"}
        description="Leave the password blank to keep the existing one."
        onClose={() => setOpenEditEntry(null)}
        okLabel="Save changes"
        fields={[
          { name: "login", label: "Login", required: true, defaultValue: editDefaults?.login, placeholder: "username or email", autoComplete: "username" },
          { name: "password", label: "Password", type: "password", defaultValue: editDefaults?.password, placeholder: "password", autoComplete: "current-password" },
        ]}
        onSubmit={({ login, password }) => submitEditEntry(login, password)}
      />

      <GKModal
        open={deleteSiteIdx != null}
        onClose={() => setDeleteSiteIdx(null)}
        title="Delete website"
        description="This will remove the website and all its saved logins. This action cannot be undone."
        width="sm"
        initialFocusSelector="button.gk-btn-danger"
        actions={
          <>
            <button className="gk-btn" onClick={() => setDeleteSiteIdx(null)}>
              Cancel
            </button>
            <button className="gk-btn gk-btn-danger" onClick={confirmDeleteSite}>
              Delete
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to delete <strong>{deleteSiteName}</strong>?
        </p>
      </GKModal>

      <GKModal
        open={deleteEntry != null}
        onClose={() => setDeleteEntry(null)}
        title="Delete entry"
        description="This will remove the selected login from this website. This action cannot be undone."
        width="sm"
        initialFocusSelector="button.gk-btn-danger"
        actions={
          <>
            <button className="gk-btn" onClick={() => setDeleteEntry(null)}>
              Cancel
            </button>
            <button className="gk-btn gk-btn-danger" onClick={confirmDeleteEntry}>
              Delete
            </button>
          </>
        }
      >
        <p>
          Are you sure you want to delete{" "}
          <strong>{deleteEntryMeta?.entryLogin || "this entry"}</strong> from{" "}
          <strong>{deleteEntryMeta?.siteName || "this website"}</strong>?
        </p>
      </GKModal>
    </section>
  );
}