import React from "react";
import { createPortal } from "react-dom";
import { useIdentitySystem } from "../../utility/identity";
import ProfileMenuItem, { ProfileMenuItemProps } from "./ProfileMenuItem.tsx";
import { useVaultProviderActions } from "../../utility/vault-provider";
import { useNavigate } from "react-router-dom";

export type ProfileMenuProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  beforeItems: ProfileMenuItemProps[];
  afterItems?: ProfileMenuItemProps[];
};

export default function ProfileMenu({ open, anchorEl, onClose, beforeItems, afterItems = [] }: ProfileMenuProps) {
  const { currentProfile, profiles } = useIdentitySystem();
  const { validateAndImportIdentityWithVaultFromSeed } = useVaultProviderActions();
  const navigate = useNavigate();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const [submenuOpen, setSubmenuOpen] = React.useState(false);
  const [submenuTop, setSubmenuTop] = React.useState<number>(0);

  if (!containerRef.current && typeof document !== "undefined") {
    const el = document.createElement("div");
    el.className = "gk-popover-root";
    containerRef.current = el;
  }

  React.useEffect(() => {
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

  const position = React.useCallback(() => {
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

  if (!open || !containerRef.current) return null;

  const onSwitchClick = async (seed: string) => {
    try {
      await validateAndImportIdentityWithVaultFromSeed(seed);
    } catch (e) {
      console.warn('Switch profile failed', e);
    }
    setSubmenuOpen(false);
  };

  const handleToggleSubmenu = (e: React.MouseEvent<HTMLButtonElement>) => {
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

          <ProfileMenuItem label="Log Out" onClick={() => { }/**should add later */} />

          {submenuOpen && (
            <div className="gk-submenu" role="menu" style={{ top: submenuTop }}>
              {(profiles || []).slice(0, 4).map((p) => {
                const slug = shortenPrincipal((p.userID || '').replace(/^UserID_/, ''));
                return (
                  <button
                    key={p.userID}
                    className={`gk-submenu-item ${p.active ? 'active' : ''}`}
                    disabled={p.active}
                    onClick={async () => onSwitchClick(p.seedPhrase)}
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
    </div>
  );

  return createPortal(content, containerRef.current);
}

function shortenPrincipal(id: string): string {
  if (!id || id.length <= 16) return id;
  return `${id.slice(0, 8)}..${id.slice(-6)}`;
}
