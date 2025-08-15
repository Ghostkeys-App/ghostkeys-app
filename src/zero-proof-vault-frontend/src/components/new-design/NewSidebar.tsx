import React, {useState} from "react";
import { Globe, Lock, CreditCard, IdCard, Grid3X3 } from "lucide-react";
import {useIdentitySystem} from "../../utility/identity";
import VaultSelector from "./VaultSelector.tsx";

// --- Types ---
export type TemplateKey =
    | "logins"
    | "notes"
    | "payments"
    | "grid";

export interface TemplateSidebarProps {
  selected: TemplateKey;
  onSelect: (key: TemplateKey) => void;
  profile: any;
  className?: string;
}

// --- Template config ---
const TEMPLATES: Array<{
  key: TemplateKey;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  // Tailwind gradient classes for the sidebar background
  bg: string; // e.g. "from-blue-600 to-blue-500"
}> = [
  {
    key: "logins",
    label: "Website logins",
    icon: Globe,
    bg: "from-blue-600 to-blue-500",
  },
  {
    key: "notes",
    label: "Secure notes",
    icon: Lock,
    bg: "from-amber-500 to-amber-400",
  },
  {
    key: "payments",
    label: "Payment details",
    icon: CreditCard,
    bg: "from-orange-500 to-orange-400",
  },
  {
    key: "grid",
    label: "Flexible grid",
    icon: Grid3X3,
    bg: "from-green-500 to-green-400",
  },
];

// Utility to join class names
function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/**
 * Ghostkeys template sidebar
 * - The entire sidebar background color/gradient changes with the selected template
 * - Buttons become translucent and rely on the panel color for selected state
 * - Minimal, keyboard-accessible, and animated
 */
export default function TemplateSidebar({
                                          selected,
                                          onSelect,
                                          profile,
                                          className,
                                        }: TemplateSidebarProps) {
  const active = TEMPLATES.find((t) => t.key === selected) ?? TEMPLATES[0];
  const { currentProfile } = useIdentitySystem();
  const id = currentProfile?.icpPublicKey || "";
  const [showCopied, setShowCopied] = useState(false);

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
          className={cx(
              // container
              "w-80 shrink-0 rounded-r-3xl p-4 sm:p-5 text-white transition-[background,box-shadow] duration-300",
              // dynamic gradient background
              `bg-gradient-to-b ${active.bg}`,
              "gk-sidebar",
              className
          )}
          role="navigation"
          aria-label="Templates"
          style={{
            color: selected == 'logins' || selected == 'grid' ? 'white' : 'black',
          }}
      >
        <img src={selected == 'logins' || selected == 'grid' ? '/white-logo.png' : '/black-logo.png'} alt={'logo'}
             className={'logo'}></img>

        <VaultSelector />

        <nav className="flex flex-col gap-2 gk-nav">
          {TEMPLATES.map((t) => {
            const isActive = t.key === selected;
            return (
                <button
                    key={t.key}
                    onClick={() => onSelect(t.key)}
                    className={cx(
                        // layout
                        "group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left",
                        // base visual
                        "backdrop-blur-[1px] transition-all duration-150",
                        // selected vs idle
                        isActive
                            ? // Selected: transparent pill with subtle ring / lift so it blends with the panel color
                            "bg-white/10 ring-2 ring-white/40 shadow-lg shadow-black/10 translate-x-0.5"
                            : // Idle: faint translucent with hover lift
                            "bg-white/5 hover:bg-white/10 hover:translate-x-0.5 active:scale-[0.99]",
                        "gk-item",
                        t.key
                    )}
                    aria-current={isActive ? "page" : undefined}
                    data-key={t.key}
                    style={{
                      boxShadow: '0 10px 24px rgba(0,0,0,.18), ' + (selected == 'logins' || selected == 'grid' ? 'white' : 'black')
                    }}
                >
                  {/* Icon */}
                  <t.icon
                      className={cx(
                          "h-5 w-5 flex-none",
                          isActive ? "opacity-100 drop-shadow-[0_1px_6px_rgba(255,255,255,0.35)]" : "opacity-90",
                          "gk-icon"
                      )}
                      strokeWidth={2.25}
                  />
                  {/* Label */}
                  <span
                      className={cx("font-medium tracking-tight", isActive ? "" : "opacity-95", "gk-label")}>{t.label}</span>
                  {/* Right affordance – optional chevron hint */}
                  <svg
                      className={cx(
                          "ml-auto h-4 w-4 transition-transform",
                          isActive ? "translate-x-0.5 opacity-100" : "opacity-60 group-hover:translate-x-0.5",
                          "gk-chevron"
                      )}
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
          <img src={selected == 'logins' || selected == 'grid' ? '/ghost-white.png' : '/ghost-black.png'} alt={'logo'}
               className={'profile-icon'}></img>
          {profile?.nickname || "Anon"}
          {id && (
              <div
                  className={`copy-box ${showCopied ? 'copied' : ''}`}
                  onClick={copyToClipboard}
                  title={`Click to copy full ID: ${id}`}
                  style={{
                    borderColor: selected == 'logins' || selected == 'grid' ? 'var(--light-border-color)' : 'var(--dark-border-color)',
                  }}
              >
                {showCopied ? "Copied ✓" : shortenId(id)}
              </div>
          )}
        </div>
      </aside>
  );
}