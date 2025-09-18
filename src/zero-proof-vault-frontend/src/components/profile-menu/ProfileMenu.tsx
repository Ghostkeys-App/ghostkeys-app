import { useCallback, useEffect, useRef, useState, MouseEvent } from "react";
import { createPortal } from "react-dom";
import { indexDBProfile, useIdentitySystem } from "../../utility/identity";
import ProfileMenuItem, { ProfileMenuItemProps } from "./ProfileMenuItem.tsx";
import { useVaultProviderActions, useVaultProviderState } from "../../utility/vault-provider";
import { useNavigate } from "react-router-dom";
import { toast } from "../../utility/toast/toast.ts";
import GKModal from "../modals/gk-modal/GKModal.tsx";

export type ProfileMenuProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  beforeItems: ProfileMenuItemProps[];
  afterItems?: ProfileMenuItemProps[];
};

export default function ProfileMenu({ open, anchorEl, onClose, beforeItems, afterItems = [] }: ProfileMenuProps) {
  const { currentProfile, profiles } = useIdentitySystem();
  const { validateAndImportIdentityWithVaultFromSeed, logOut } = useVaultProviderActions();
  const { currentVault } = useVaultProviderState();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [submenuTop, setSubmenuTop] = useState<number>(0);
  const [seedToSwitchPrompt, setSeedToSwitchPrompt] = useState<string>('');
  const [logOutOpen, setLogOutOpen] = useState(false);

  if (!containerRef.current && typeof document !== "undefined") {
    const el = document.createElement("div");
    el.className = "gk-popover-root";
    containerRef.current = el;
  }

  useEffect(() => {
    const el = containerRef.current!;
    if (open) {
      document.body.appendChild(el);
      const onResize = () => position();
      window.addEventListener('resize', onResize);
      window.addEventListener('scroll', onResize, true);
      position();
      return () => {
        el.remove();
        window.removeEventListener('resize', onResize);
        window.removeEventListener('scroll', onResize, true);
      };
    }
  }, [open, anchorEl]);

  const position = useCallback(() => {
    if (!anchorEl || !panelRef.current) return;
    const r = anchorEl.getBoundingClientRect();
    const menu = panelRef.current;
    // temporarily show to measure
    const prev = menu.style.visibility;
    menu.style.visibility = 'hidden';
    menu.style.display = 'block';
    const mw = menu.offsetWidth;
    const mh = menu.offsetHeight;
    menu.style.visibility = prev || '';

    let left = r.left / 2;
    let top = r.top - mh - 10; // prefer above
    if (top < 10) top = r.bottom + 10; // fallback below
    if (left + mw > window.innerWidth - 10) left = window.innerWidth - mw - 10;
    if (left < 10) left = 10;
    setPos({ left, top });
  }, [anchorEl]);

  const onSwitchProfileConfirm = useCallback(async (seed: string) => {
    try {
      const result = await validateAndImportIdentityWithVaultFromSeed(seed);
      if (result) {
        toast.success("Successfully switched profile!", { idiotProof: true });
      } else {
        toast.error("Error on switching profile, check console!", { idiotProof: true });
      }
    } catch (e) {
      console.warn('Switch profile failed', e);
    }
    setSubmenuOpen(false);
  }, [])

  const onSwitchClick = useCallback(async (profile: indexDBProfile) => {
    // we can't switch to not synced profile
    if (!profile.commited) {
      toast.error("Profile you want to switch to is not saved to server. Navigate to Settings to save it.");
      setSeedToSwitchPrompt("");
      setSubmenuOpen(false);
      return;
    }
    if (!currentVault?.synced) {
      setSeedToSwitchPrompt(profile.seedPhrase);
    } else {
      await onSwitchProfileConfirm(profile.seedPhrase);
    }
  }, [currentVault, currentProfile]);

  if (!open || !containerRef.current) return null;

  const handleToggleSubmenu = (e: MouseEvent<HTMLButtonElement>) => {
    const menu = panelRef.current?.querySelector('.gk-menu') as HTMLElement | null;
    if (menu) {
      const mr = menu.getBoundingClientRect();
      const sr = e.currentTarget.getBoundingClientRect();
      const top = (sr.top - mr.top) - sr.height * (profiles.length + 1);
      setSubmenuTop(top);
    }
    setSubmenuOpen((v) => !v);
  };

  const onCloseProfile = () => {
    setSubmenuOpen(false);
    onClose();
  }

  const enhancedBefore = beforeItems;
  const enhancedAfter = afterItems.map((it) =>
    it.hasSubmenu && !it.onClick ? { ...it, onClick: handleToggleSubmenu } : it
  );

  const content = (
    <div className="gk-popover-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseProfile(); }}>
      <div className="gk-popover" ref={panelRef} style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
        <div className="gk-menu">
          <div className="gk-menu-identity" title={currentProfile.principal.toString()}>
            <img src={'/ghost-white.png'} alt="profile" className="gk-menu-avatar" />
            <div className="gk-menu-id-text">
              {shortenPrincipal(currentProfile.principal.toString())}
            </div>
          </div>

          {enhancedBefore.map((it, i) => (
            <ProfileMenuItem key={i} {...it} />
          ))}

          <div className="gk-menu-separator" />

          {enhancedAfter.map((it, i) => (
            <ProfileMenuItem key={`aft-${i}`} {...it} />
          ))}


          <div className="gk-menu-separator" />

          {/* I would need to move this one later to the New Sidebar really */}

          <ProfileMenuItem label="Log Out" onClick={() => setLogOutOpen(true)} />

          {submenuOpen && (
            <div className="gk-submenu" role="menu" style={{ top: submenuTop }}>
              {(profiles || []).slice(0, 4).map((p) => {
                const slug = shortenPrincipal((p.userID || '').replace(/^UserID_/, ''));
                return (
                  <button
                    key={p.userID}
                    className={`gk-submenu-item ${p.active ? 'active' : ''}`}
                    disabled={p.active}
                    onClick={async () => onSwitchClick(p)}
                  >
                    <span className="gk-submenu-label">{slug}</span>
                    {p.active && <span className="gk-submenu-badge">Active</span>}
                  </button>
                );
              })}

              <div className="gk-menu-separator" />

              <button
                className="gk-submenu-item"
                onClick={() => { navigate('/settings/profiles'); onCloseProfile(); }}
              >
                <span className="gk-submenu-label">Manage Identities</span>
              </button>
            </div>
          )}
        </div>
      </div>
      <GKModal
        open={seedToSwitchPrompt != ''}
        onClose={() => setSeedToSwitchPrompt('')}
        title="Vault is not synced, do you still want to switch?"
        description="This will discard unsynced local changes and switch to the other profile."
        width="sm"
        actions={
          <>
            <button className="gk-btn ghost" onClick={() => setSeedToSwitchPrompt('')}>Cancel</button>
            <button
              className="gk-btn danger"
              onClick={async () => { await onSwitchProfileConfirm(seedToSwitchPrompt); setSeedToSwitchPrompt('') }}
            >
              Switch
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

      <GKModal
        open={logOutOpen}
        onClose={() => setLogOutOpen(false)}
        title="Do you really want to Log Out?"
        description="By loggin out all of the local not-synced changes and all of the local settings will be eraced and you would be presented with new Profile."
        width="sm"
        actions={
          <>
            <button className="gk-btn ghost" onClick={() => setLogOutOpen(false)}>Cancel</button>
            <button
              className="gk-btn danger"
              onClick={async () => {
                await logOut();
                // Hard reload + redirect 
                // TODO: Look at this later if we need to change
                window.location.href = "/";
              }}
            >
              Log Out
            </button>
          </>
        }
      >
      </GKModal>
    </div>
  );

  return createPortal(content, containerRef.current);
}

function shortenPrincipal(id: string): string {
  if (!id || id.length <= 16) return id;
  return `${id.slice(0, 8)}..${id.slice(-6)}`;
}
