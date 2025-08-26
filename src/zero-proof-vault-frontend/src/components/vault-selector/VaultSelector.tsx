import React, { useCallback } from "react";
import { useVaultProviderActions, useVaultProviderState } from "../../utility/vault-provider";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import GKFormModal from "../modals/gk-form-modal/GKFormModal.tsx";
import GKModal from "../modals/gk-modal/GKModal.tsx";
import { toast } from "../../utility/toast";

export default function VaultSelector() {
  const [open, setOpen] = React.useState(false);
  const { vaults, currentVault, currentVaultId } = useVaultProviderState();
  const { createVault, deleteVault, switchVault, renameVault, deleteVaultFromIC } = useVaultProviderActions();

  const [actionsOpen, setActionsOpen] = React.useState(false);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);

  const rootRef = React.useRef<HTMLDivElement>(null);

  function selectVault(vaultID: string) {
    switchVault(vaultID);
    setOpen(false);
    setActionsOpen(false);
  }

  async function onCreateVaultClick() {
    const vaultName = prompt("New vault name?")?.trim();
    if (!vaultName) return;
    await createVault(vaultName);
    setOpen(false);
    setActionsOpen(false);
  }

    const submitCreate = useCallback(async (values: Record<string, string>) => {
    const next = values.name?.trim();
    if (!next || !currentVault) return;
    if (await createVault(next)) {
      toast.success("Successfuly created new vault.")
    } else {
      toast.warning("Couldn't create vault.")
    }
    setCreateOpen(false);
    setActionsOpen(false);
    setOpen(false);
  }, [currentVault]);

  React.useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setActionsOpen(false);
      }
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!actionsOpen) return;
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [actionsOpen]);

  React.useEffect(() => {
    if (open) setActionsOpen(false);
  }, [open]);

  const toggleActions = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) return; // disabled while dropdown is open
    setActionsOpen(s => !s);
  };

  const submitRename = useCallback(async (values: Record<string, string>) => {
    const next = values.name?.trim();
    if (!next || !currentVault) return;
    if (await renameVault(currentVault.vaultID, next)) {
      toast.success("Successfuly renamed vault")
    } else {
      toast.warning("Couldn't rename vault.")
    }
    setRenameOpen(false);
    setActionsOpen(false);
  }, [currentVault]);

  const confirmDelete = useCallback(async () => {
    if (!currentVault) return;
    if (currentVault.existsOnIc) {
      const deleteOnIc = await deleteVaultFromIC(currentVault.icpPublicAddress)
      if (deleteOnIc) {
        await deleteVault(currentVault.vaultID);
        toast.success("Vault has been removed from IC");
      }
    } else {
      await deleteVault(currentVault.vaultID);
      toast.success("Vault deleted locally. Doesn't exists on IC")
    }
    setDeleteOpen(false);
    setActionsOpen(false);
  }, [currentVault]);


  return (
    <div className="gk-vault" ref={rootRef}>
      {/* Toggle pill */}
      <button
        className="gk-vault-toggle"
        onClick={() => setOpen(s => !s)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="gk-vault-dot" style={{ background: '#FFAAFA' }} />
        <span className="gk-vault-name">{currentVault?.vaultName}</span>
        {/*<span className="gk-vault-meta">{active.items} items · {active.lastSync}</span>*/}
        <svg className={`gk-vault-caret ${open ? "is-open" : ""}`} viewBox="0 0 20 20" aria-hidden>
          <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <button
        type="button"
        className={`gk-vault-more ${actionsOpen ? "is-open" : ""}`}
        aria-haspopup="true"
        aria-expanded={actionsOpen}
        aria-label={open ? "Close vault list to manage" : "Vault actions"}
        onClick={toggleActions}
        disabled={open}
        title={open ? "Close the vault list to manage this vault" : "Vault actions"}
      >
        <MoreVertical size={16} />
      </button>

      <div className={`gk-vault-actions-tray ${actionsOpen ? "is-open" : ""}`} aria-hidden={!actionsOpen}>
        <button
          className="icon-btn"
          title="Rename vault"
          aria-label="Rename vault"
          onClick={() => { setRenameOpen(true); }}
        >
          <Pencil size={16} />
        </button>
        <button
          className="icon-btn danger"
          title="Delete vault"
          aria-label="Delete vault"
          onClick={() => { setDeleteOpen(true); }}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Flyout */}
      {open && (
        <>
          <div className="gk-vault-backdrop" onClick={() => setOpen(false)} />
          <div className="gk-vault-flyout" role="listbox" aria-label="Select vault">
            {/* Subtle header with search */}
            <div className="gk-vault-head">
              <div className="gk-vault-title">
                Vaults
              </div>
              {/*<div className="gk-vault-search">*/}
              {/*  <svg viewBox="0 0 24 24" aria-hidden><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>*/}
              {/*  <input*/}
              {/*      placeholder="Search vaults…"*/}
              {/*      value={q}*/}
              {/*      onChange={(e) => setQ(e.target.value)}*/}
              {/*  />*/}
              {/*</div>*/}
            </div>

            {/* Vault tiles */}
            <div className="gk-vault-grid">
              {vaults.map(v => (
                <button
                  key={v.vaultID}
                  className={`gk-vault-tile ${v.vaultID === currentVaultId ? "is-active" : ""}`}
                  role="option"
                  aria-selected={v.vaultID === currentVaultId}
                  onClick={() => selectVault(v.vaultID)}
                >
                  <div className="gk-vault-spark" style={{ background: '#FFAAFA' }} />
                  <div className="gk-vault-info">
                    <div className="gk-vault-label">{v?.vaultName}</div>
                    {/*<div className="gk-vault-sub">{v.items} items · {v.lastSync}</div>*/}
                  </div>
                  <svg className="gk-vault-arrow" viewBox="0 0 20 20" aria-hidden>
                    <path d="M7 5l6 5-6 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              ))}

              {/* New vault CTA */}
              <button className="gk-vault-new" onClick={() => setCreateOpen(true)}>
                <svg viewBox="0 0 24 24" aria-hidden style={{ width: 24 }}>
                  <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                New vault
              </button>
            </div>
          </div>
        </>
      )}
      <GKFormModal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Rename vault"
        description="Change the name of your current vault."
        okLabel="Save"
        fields={[
          {
            name: "name",
            label: "Vault name",
            placeholder: "e.g. Personal Vault",
            defaultValue: currentVault?.vaultName ?? "",
            required: true,
          },
        ]}
        onSubmit={submitRename}
      />

      <GKFormModal
        open={createOpen}
        onClose={() => {setCreateOpen(false); setOpen(false);}}
        title="Create new vault"
        description="Set name for your new vault"
        okLabel="Save"
        fields={[
          {
            name: "name",
            label: "Vault name",
            placeholder: "e.g. Personal Vault",
            required: true,
          },
        ]}
        onSubmit={submitCreate}
      />

      <GKModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete vault?"
        description="This will remove selected vault from your device and IC storage. Are you sure you want to proceed?"
        width="sm"
        actions={
          <>
            <button className="gk-btn ghost" onClick={() => setDeleteOpen(false)}>
              Cancel
            </button>
            <button className="gk-btn danger" onClick={confirmDelete}>
              Delete
            </button>
          </>
        }
      >
        <div className="gk-form">
          <label className="gk-field">
            <span>Vault</span>
            <input disabled value={currentVault?.vaultName ?? "—"} />
          </label>
        </div>
      </GKModal>
    </div>
  );
}