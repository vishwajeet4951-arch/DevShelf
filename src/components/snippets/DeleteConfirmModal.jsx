import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, snippetTitle, onConfirm, onCancel, isDeleting }) {
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus();
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onCancel();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div 
        className="relative w-full max-w-md bg-white dark:bg-dev-sidebar-dark rounded-xl border border-slate-200 dark:border-dev-sidebar-border shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 id="delete-dialog-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                Delete Snippet
              </h3>
              <p id="delete-dialog-description" className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Are you sure you want to delete <span className="font-semibold text-slate-900 dark:text-slate-200">"{snippetTitle}"</span>? This will permanently remove it from local IndexedDB and cannot be undone.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-dev-sidebar-border flex items-center justify-end gap-2.5">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Permanently'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
