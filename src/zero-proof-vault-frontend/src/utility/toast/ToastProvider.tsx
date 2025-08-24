import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { _bindAddToast, ToastOptions, ToastType } from './toast';

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
    Object.assign(el.className, 'toast-root');
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
                  <Toast key={t.id} message={t.message} type={t.type} />
              ))}
            </div>,
            portalRoot
        )}
      </>
  );
};

const typeStyles: Record<ToastType, React.CSSProperties> = {
  success: { borderLeft: '4px solid #16a34a' },
  error: { borderLeft: '4px solid #dc2626' },
  info: { borderLeft: '4px solid #2563eb' },
  warning: { borderLeft: '4px solid #d97706' },
};

const Toast: React.FC<{ message: string; type: ToastType }> = ({ message, type }) => {
  return (
      <div className={`toast ${type}`}>
        <div className={'toast-icon'}>🔔</div>
        <div className={'toast-message'}>{message}</div>
      </div>
  );
};
