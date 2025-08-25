import React, { useCallback, useEffect, useState } from "react";
import { Globe, Lock, CreditCard, IdCard, Grid3X3 } from "lucide-react";
import { useIdentitySystem } from "../../utility/identity";
import VaultSelector from "./VaultSelector.tsx";
import { useVaultProviderActions } from "../../utility/vault-provider/index.tsx";
import ProfileModal from "./ProfileModal";
import { toast } from "../../utility/toast/toast.ts";

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
  const [showCopied, setShowCopied] = useState(false);
  const { validateAndImportIdentityWithVaultFromSeed } = useVaultProviderActions();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const openProfile = () => {
    setShowProfileModal(true);
  };

  const handleImport = async (seed: string) => {
    const success = await validateAndImportIdentityWithVaultFromSeed(seed);
    if (success) {
      toast.success("Successfully imported user from provide seed phrase!");
    } else {
      toast.error("Error on importing user from seed phrase, check console!");
    }
  };

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
      <ProfileModal
        open={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onImport={handleImport}
      />
    </aside>
  );
}