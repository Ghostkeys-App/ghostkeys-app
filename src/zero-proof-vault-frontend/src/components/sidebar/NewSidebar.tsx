import React, { useCallback, useEffect, useState } from "react";
import { Globe, Lock, Grid3X3, RotateCcw } from "lucide-react";
import { useIdentitySystem } from "../../utility/identity";
import VaultSelector from "../vault-selector/VaultSelector.tsx";
import { useVaultProviderActions, useVaultProviderState } from "../../utility/vault-provider";
import ProfileModal from "../modals/profile-modal/ProfileModal.tsx";
import { toast } from "../../utility/toast";
import { english } from "viem/accounts";
import GKModal from "../modals/gk-modal/GKModal.tsx";

// --- Types ---
export type TemplateKey =
  | "logins"
  | "notes"
  | "grid";

export interface TemplateSidebarProps {
  selected: TemplateKey;
  onSelect: (key: TemplateKey) => void;
  className?: string;
}

// --- Template config ---
const TEMPLATES: Array<{
  key: TemplateKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
    {
      key: "grid",
      label: "Spreadsheet",
      icon: Grid3X3,
    },
    {
      key: "logins",
      label: "Website logins",
      icon: Globe,
    },
    {
      key: "notes",
      label: "Secure notes",
      icon: Lock,
    },
  ];

// Utility to join class names
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function TemplateSidebar({
  selected,
  onSelect,
}: TemplateSidebarProps) {
  const { currentProfile } = useIdentitySystem();
  const { validateAndImportIdentityWithVaultFromSeed } = useVaultProviderActions();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [confirmReloadOpen, setConfirmReloadOpen] = useState(false);
  const [canReload, setCanReload] = useState(false);

  const { currentVault } = useVaultProviderState();
  const { getICVault, saveCurrentVaultDataToIDB } = useVaultProviderActions();

  useEffect(() => {
    setCanReload(!!currentVault?.existsOnIc);
  }, [currentVault]);

  const openProfile = () => {
    setShowProfileModal(true);
  };

  const doReload = useCallback(async () => {
    if (currentVault?.existsOnIc) {
      const vaultFromIC = await getICVault(currentVault.icpPublicAddress);
      if (vaultFromIC === null) {
        toast.error("Failed to get vault from Storage.");
        return;
      }
      await saveCurrentVaultDataToIDB(vaultFromIC.data, true, vaultFromIC.vaultName);
      toast.success("Reloaded from Storage.");
    } else {
      toast.error("No saved version found in Storage.");
    }
  }, [currentVault]);

  const onReloadClick = useCallback(() => {
    if (currentVault && !currentVault.synced) {
      setConfirmReloadOpen(true);
    } else {
      void doReload();
    }
  }, [currentVault]);

  const validateSeedPhraseText = useCallback((seedToValidate: string): { valid: boolean, error?: string } => {
    const seedWords = seedToValidate.split(' ');
    const validLenght = seedWords.length === 12;
    if (!validLenght)
      return { valid: false, error: "Seed lenght invalid!" }

    const notKnownInSpecifiedSeed = seedWords.find((w => !english.includes(w)));
    if (notKnownInSpecifiedSeed)
      return { valid: false, error: "Seed is not generated from specified pool of words!" }
    return { valid: true }
  }, [currentProfile]);

  const handleImport = useCallback(async (seed: string) => {
    const textValid = validateSeedPhraseText(seed);
    if (!textValid.valid) {
      toast.error(textValid.error!, { idiotProof: true });
      return;
    }
    const success = await validateAndImportIdentityWithVaultFromSeed(seed);
    if (success) {
      toast.success("Successfully imported user from provide seed phrase!", { idiotProof: true });
    } else {
      toast.error("Error on importing user from seed phrase, check console!", { idiotProof: true });
    }
  }, []);

  const shortenId = (id: string): string => {
    if (!id || id.length <= 16) return id;
    return `${id.slice(0, 8)}..${id.slice(-6)}`;
  };

  return (
    <aside
      className={"gk-sidebar"}
      role="navigation"
      aria-label="Templates"
    >
      <div className="gk-div-separator">
        <img src={'/white-logo.png'} alt={'logo'} className={'logo'}></img>

        <VaultSelector />

        <nav className="flex flex-col gap-2 gk-nav">
          {TEMPLATES.map((t) => {
            const isActive = t.key === selected;
            return (
              <button
                onClick={() => onSelect(t.key)}
                className={cx(
                  "gk-item",
                  t.key
                )}
                aria-current={isActive ? "page" : undefined}
                data-key={t.key}
              >
                {/* Icon */}
                <t.icon
                  className={"gk-icon"}
                  strokeWidth={2.25}
                />
                {/* Label */}
                <span className={"gk-label"}>{t.label}</span>
                {/* Right affordance – optional chevron hint */}
                <svg
                  className={"gk-chevron"}
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden
                >
                  <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    strokeLinejoin="round" />
                </svg>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="gk-div-profile-separator">
        <button
          disabled={!canReload}
          aria-disabled={!canReload}
          type="button"
          className={`gk-ic-reload ${!canReload ? "is-disabled" : ""}`}
          onClick={onReloadClick}
          title="Discard local changes & reload saved version from IC"
        >
          <RotateCcw size={16} strokeWidth={2.25} />
          <span>Reload from Storage</span>
        </button>
        <div
          className="profile profile-cta"
          role="button"
          tabIndex={0}
          aria-label="Open profile settings"
          onClick={openProfile}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && openProfile()}
          data-tip="Profile & Settings"
        >
          <img
            src={"/ghost-white.png"}
            alt={"profile"}
            className={"profile-icon pulse-once"}
          />
          <div className="profile-text">
            <span className="profile-label">Profile</span>
            <span className="profile-id">{shortenId(currentProfile.principal.toString())}</span>
          </div>
          <svg className="chevron" viewBox="0 0 20 20" aria-hidden>
            <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </div>
      </div>
      <ProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onImport={handleImport}
      />
      <GKModal
        open={confirmReloadOpen}
        onClose={() => setConfirmReloadOpen(false)}
        title="Reload from IC?"
        description="This will discard unsynced local changes and reload the saved version from the Internet Computer."
        width="sm"
        actions={
          <>
            <button className="gk-btn ghost" onClick={() => setConfirmReloadOpen(false)}>Cancel</button>
            <button
              className="gk-btn danger"
              onClick={async () => { await doReload(); setConfirmReloadOpen(false); }}
            >
              Reload
            </button>
          </>
        }
      >
        <div className="gk-form">
          <label className="gk-field">
            <span>Current Vault</span>
            <input disabled value={currentVault?.vaultName ?? "—"} />
          </label>
        </div>
      </GKModal>
    </aside>
  );
}