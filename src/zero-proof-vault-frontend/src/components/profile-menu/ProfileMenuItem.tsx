import React from "react";

export type ProfileMenuItemProps = {
  icon?: React.ReactNode;
  label: string;
  disabled?: boolean;
  hasSubmenu?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
};

export function ProfileMenuItem({ icon, label, disabled, hasSubmenu, onClick, title }: ProfileMenuItemProps) {
  return (
    <button
      className={`gk-menu-item ${disabled ? 'is-disabled' : ''}`}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {icon}
      <span>{label}</span>
      {hasSubmenu && (
        <svg viewBox="0 0 20 20" width="18" height="18" className="gk-menu-chevron" aria-hidden>
          <path d="M7 5l6 5-6 5" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      )}
    </button>
  );
}

export default ProfileMenuItem;
