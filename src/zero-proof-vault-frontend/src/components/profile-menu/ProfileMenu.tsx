import React from "react";
import { createPortal } from "react-dom";
import { useIdentitySystem } from "../../utility/identity";
import ProfileMenuItem, { ProfileMenuItemProps } from "./ProfileMenuItem.tsx";

export type ProfileMenuProps = {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  beforeItems: ProfileMenuItemProps[];
  afterItems?: ProfileMenuItemProps[];
};

export default function ProfileMenu({ open, anchorEl, onClose, beforeItems, afterItems = [] }: ProfileMenuProps) {
  const { currentProfile } = useIdentitySystem();
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

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

    let left = r.left / 10;
    let top = r.top - mh - 10; // prefer above
    if (top < 10) top = r.bottom + 10; // fallback below
    if (left + mw > window.innerWidth - 10) left = window.innerWidth - mw - 10;
    if (left < 10) left = 10;
    setPos({ left, top });
  }, [anchorEl]);

  if (!open || !containerRef.current) return null;

  const content = (
    <div className="gk-popover-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gk-popover" ref={panelRef} style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
        <div className="gk-menu">
          <div className="gk-menu-identity" title={currentProfile.principal.toString()}>
            <img src={'/ghost-white.png'} alt="profile" className="gk-menu-avatar" />
            <div className="gk-menu-id-text">
              {shortenPrincipal(currentProfile.principal.toString())}
            </div>
          </div>

          {beforeItems.map((it, i) => (
            <ProfileMenuItem key={i} {...it} />
          ))}

          <div className="gk-menu-separator" />

          {afterItems.map((it, i) => (
            <ProfileMenuItem key={`aft-${i}`} {...it} />
          ))}
          
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

