import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      onClose();
    }, toast.duration || 3500);

    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-sky-500 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30 bg-emerald-950/20 text-emerald-200',
    error: 'border-rose-500/30 bg-rose-950/20 text-rose-200',
    info: 'border-sky-500/30 bg-sky-950/20 text-sky-200',
  };

  return (
    <div 
      className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-2 duration-200"
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className={`flex items-start gap-3 p-3.5 rounded-xl border bg-white dark:bg-dev-sidebar-dark shadow-xl backdrop-blur-md ${borders[toast.type || 'info'] || borders.info}`}>
        {icons[toast.type || 'info'] || icons.info}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <p className="text-xs font-semibold text-slate-900 dark:text-white mb-0.5">
              {toast.title}
            </p>
          )}
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {toast.message}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
