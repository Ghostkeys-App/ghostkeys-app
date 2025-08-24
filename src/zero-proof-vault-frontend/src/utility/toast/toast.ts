export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastOptions = {
  message: string;
  id?: number;
  type?: ToastType;
  durationMs?: number;
};

type AddToastFn = (opts: ToastOptions) => void;

let _addToast: AddToastFn | null = null;

export function _bindAddToast(fn: AddToastFn) {
  _addToast = fn;
}

function core(message: string, opts: Omit<ToastOptions, 'message'> = {}) {
  if (!_addToast) throw new Error('ToastProvider is not mounted.');
  _addToast({ message, durationMs: 3000, type: 'info', ...opts });
}

export const toast = Object.assign(core, {
  success: (message: string, opts: Omit<ToastOptions, 'message'> = {}) =>
      core(message, { ...opts, type: 'success' }),
  error: (message: string, opts: Omit<ToastOptions, 'message'> = {}) =>
      core(message, { ...opts, type: 'error' }),
  info: (message: string, opts: Omit<ToastOptions, 'message'> = {}) =>
      core(message, { ...opts, type: 'info' }),
  warning: (message: string, opts: Omit<ToastOptions, 'message'> = {}) =>
      core(message, { ...opts, type: 'warning' }),
});
