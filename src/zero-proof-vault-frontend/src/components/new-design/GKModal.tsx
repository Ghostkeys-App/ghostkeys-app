import React from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  width?: "sm" | "md" | "lg";
  onClose: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode; // buttons in the footer
  initialFocusSelector?: string; // e.g. 'input, textarea, button'
};

export default function GKModal({
                                  open,
                                  title,
                                  description,
                                  width = "md",
                                  onClose,
                                  children,
                                  actions,
                                  initialFocusSelector = "input, textarea, button, [tabindex]:not([tabindex='-1'])",
                                }: ModalProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const lastFocused = React.useRef<HTMLElement | null>(null);

  // create portal container
  if (!containerRef.current && typeof document !== "undefined") {
    const el = document.createElement("div");
    el.className = "gk-modal-root";
    containerRef.current = el;
  }

  // mount/unmount
  React.useEffect(() => {
    const el = containerRef.current!;
    if (open) {
      document.body.appendChild(el);
      // lock scroll
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      lastFocused.current = document.activeElement as HTMLElement;
      // initial focus
      requestAnimationFrame(() => {
        const target = dialogRef.current?.querySelector<HTMLElement>(initialFocusSelector);
        (target || dialogRef.current)?.focus();
      });
      return () => {
        // unlock scroll
        document.body.style.overflow = prev;
        el.remove();
        // restore focus
        lastFocused.current?.focus?.();
      };
    }
  }, [open, initialFocusSelector]);

  // close on ESC
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // focus trap
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusables = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
            "a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex='-1'])"
        ) || []
    ).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // 3D tilt
  const onMouseMove = (e: React.MouseEvent) => {
    const el = dialogRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = (e.clientX - cx) / (r.width / 2);
    const dy = (e.clientY - cy) / (r.height / 2);
    el.style.setProperty("--rx", `${(dy * -6).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(dx * 6).toFixed(2)}deg`);
  };
  const onMouseLeave = () => {
    const el = dialogRef.current;
    if (!el) return;
    el.style.setProperty("--rx", `0deg`);
    el.style.setProperty("--ry", `0deg`);
  };

  if (!open || !containerRef.current) return null;

  return createPortal(
      <div
          className="gk-modal-overlay"
          aria-hidden={!open}
          onMouseDown={(e) => {
            // backdrop click closes (ignore clicks that start on the dialog)
            if (e.target === e.currentTarget) onClose();
          }}
      >
        {/* decorative particles */}
        <div className="gk-modal-stars" aria-hidden="true" />
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gk-modal-title"
            aria-describedby={description ? "gk-modal-desc" : undefined}
            className={`gk-modal ${width}`}
            ref={dialogRef}
            tabIndex={-1}
            onKeyDown={onKeyDown}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
        >
          <div className="gk-modal-glow" aria-hidden="true" />
          <header className="gk-modal-header">
            <h2 id="gk-modal-title">{title}</h2>
            {description && <p id="gk-modal-desc">{description}</p>}
            <button
                className="gk-modal-close"
                aria-label="Close"
                onClick={onClose}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div className="gk-modal-body">{children}</div>

          {actions && <footer className="gk-modal-actions">{actions}</footer>}
        </div>
      </div>,
      containerRef.current
  );
}
