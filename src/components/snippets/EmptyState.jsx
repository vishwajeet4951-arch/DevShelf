import React from 'react';
import { 
  Code2, 
  ShieldCheck, 
  Zap, 
  HardDrive,
  Plus
} from 'lucide-react';

export default function EmptyState({ activeFilter = 'all', onNewSnippet }) {
  const getFilterLabel = () => {
    if (activeFilter === 'pinned') return 'Pinned Snippets';
    if (activeFilter === 'favorites') return 'Favorite Snippets';
    if (activeFilter.startsWith('folder:')) return `Folder: ${activeFilter.replace('folder:', '')}`;
    if (activeFilter.startsWith('lang:')) return `Language: ${activeFilter.replace('lang:', '')}`;
    return 'All Snippets';
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 text-center select-none animate-in fade-in duration-300">
      <div className="max-w-xl w-full">
        {/* Terminal Header Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-6">
          <span className="w-2 h-2 rounded-full bg-indigo-500" />
          <span>status: devshelf_ready</span>
          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="text-indigo-600 dark:text-indigo-400 font-semibold">{getFilterLabel()} (0)</span>
        </div>

        {/* Central Developer Illustration Icon */}
        <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-2xl blur-xl" />
          <div className="relative w-20 h-20 rounded-2xl bg-white dark:bg-dev-sidebar-dark border border-slate-200/80 dark:border-dev-sidebar-border shadow-lg shadow-indigo-500/5 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Code2 className="w-10 h-10 stroke-[1.75]" />
          </div>
        </div>

        {/* Title & Description */}
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white font-sans mb-3">
          Your Code Shelf is Empty
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6 max-w-md mx-auto">
          No snippets found in this view. Store your everyday shell commands, reusable algorithms, and config files locally and securely in IndexedDB.
        </p>

        {/* Action Button */}
        {onNewSnippet && (
          <div className="mb-8">
            <button
              type="button"
              onClick={onNewSnippet}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Snippet</span>
            </button>
          </div>
        )}

        {/* Architecture & Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left mb-6">
          <div className="p-3.5 rounded-xl bg-white dark:bg-dev-sidebar-dark/70 border border-slate-200/80 dark:border-dev-sidebar-border shadow-xs">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2.5">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-1">
              IndexedDB Native
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Local persistent storage directly in your browser. Fast, durable, and cloud-independent.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-dev-sidebar-dark/70 border border-slate-200/80 dark:border-dev-sidebar-border shadow-xs">
            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-2.5">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-1">
              Secret Masking
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Detects tokens, credentials, and connection strings to prevent accidental screen leaks.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-white dark:bg-dev-sidebar-dark/70 border border-slate-200/80 dark:border-dev-sidebar-border shadow-xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-2.5">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-200 mb-1">
              Keyboard Driven
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
              Global Command Palette (<span className="font-mono text-[10px]">Ctrl+K</span>) for instant search, filtering, and switching.
            </p>
          </div>
        </div>

        {/* Phase Status Card */}
        <div className="px-4 py-3 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="font-medium text-slate-800 dark:text-slate-200">Phase 2 Active:</span>
            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">IndexedDB persistence & full snippet CRUD enabled</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">devshelf-db</span>
        </div>
      </div>
    </div>
  );
}
