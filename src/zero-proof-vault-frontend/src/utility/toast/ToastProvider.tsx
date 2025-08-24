import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { _bindAddToast, ToastOptions, ToastType } from './toast';
import funnyGhostIcon from "../../../public/funny-ghost.svg";

type ToastInternal = Required<ToastOptions>;

export const ToastProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);
  const idRef = useRef(0);

  const addToast = (opts: ToastOptions) => {
    const id = opts.id ?? ++idRef.current;
    const t: ToastInternal = {
      id,
      message: opts.message,
      type: opts.type ?? 'info',
      durationMs: opts.durationMs ?? 3000,
    };
    setToasts(prev => [...prev, t]);

    window.setTimeout(() => {
      setToasts(prev => prev.filter(x => x.id !== id));
    }, t.durationMs);
  };

  useEffect(() => {
    _bindAddToast(addToast);
  }, []);

  const portalRoot = useMemo(() => {
    const el = document.createElement('div');
    el.setAttribute('data-toast-root', '');
    el.className = 'toast-root';
    document.body.appendChild(el);
    return el;
  }, []);

  useEffect(() => {
    return () => {
      portalRoot.remove();
    };
  }, [portalRoot]);

  return (
      <>
        {children}
        {createPortal(
            <div>
              {toasts.map(t => (
                  <Toast key={t.id} message={t.message} type={t.type} style={{ ['--dur' as any]: `${t.durationMs}ms` }} />
              ))}
            </div>,
            portalRoot
        )}
      </>
  );
};

const Toast: React.FC<{ message: string; type: ToastType; style?: React.CSSProperties }> = ({ message, type, style }) => (
    <div className={`toast ${type}`} style={style}>
      <img className="toast-icon" src={funnyGhostIcon} alt={'funny-ghost'}/>
      <div className="toast-message">{message}</div>
    </div>
);
