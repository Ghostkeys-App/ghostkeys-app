import React, {useState} from "react";
import { Globe, Lock, CreditCard, IdCard, Grid3X3 } from "lucide-react";
import {useIdentitySystem} from "../../utility/identity";
import VaultSelector from "./VaultSelector.tsx";
import { useVaultProviderActions } from "../../utility/vault-provider/index.tsx";

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
  const id = currentProfile.principal.toString();
  const [showCopied, setShowCopied] = useState(false);
  const { validateAndImportIdentityWithVaultFromSeed } = useVaultProviderActions();

  const importUserFromSeedPrase = async () => {
    const seedPhrase = prompt("Import User from seed phrase")?.trim();
    if (!seedPhrase) return;
    console.log("New seed phrase: ", seedPhrase);
    const success = await validateAndImportIdentityWithVaultFromSeed(seedPhrase);
    if(success){

      alert("User from seed imported!");
    } 
  };

  const copyToClipboard = async () => {
    if (id) {
      try {
        await navigator.clipboard.writeText(id);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 1500);
      } catch (err) {
        console.error("Failed to copy: ", err);
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = id;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          setShowCopied(true);
          setTimeout(() => setShowCopied(false), 1500);
        } catch (fallbackErr) {
          console.error("Fallback copy failed: ", fallbackErr);
        }
        document.body.removeChild(textArea);
      }
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
                          strokeLinejoin="round"/>
                  </svg>
                </button>
            );
          })}
        </nav>

        <div className="profile">
          <img src={'/ghost-white.png'} alt={'logo'} className={'profile-icon'} onClick={importUserFromSeedPrase}></img>
          {currentProfile?.principal.toString() || "Anon"}
          {id && (
              <div
                  className={`copy-box ${showCopied ? 'copied' : ''}`}
                  onClick={copyToClipboard}
                  title={`Click to copy full ID: ${id}`}
              >
                {showCopied ? "Copied ✓" : shortenId(id)}
              </div>
          )}
        </div>
      </aside>
  );
}