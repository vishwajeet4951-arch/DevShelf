import React, { useState, useRef, useEffect } from 'react';
import { 
  Code2, 
  Menu, 
  X, 
  Sun, 
  Moon, 
  Monitor, 
  Search, 
  Command,
  Database,
  Plus,
  Download,
  Upload,
  WifiOff
} from 'lucide-react';
import { useTheme } from '../../context/useTheme';
import { useOnlineStatus } from '../../registerSW';

export default function Navbar({ 
  onToggleMobileSidebar, 
  isMobileSidebarOpen,
  onNewSnippet,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onOpenCommandPalette,
  onExportJson,
  onOpenImport
}) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef(null);

  // Close theme menu on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setIsThemeMenuOpen(false);
      }
    }
    if (isThemeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isThemeMenuOpen]);

  return (
    <header className="h-14 border-b border-dev-sidebar-lightBorder dark:border-dev-sidebar-border bg-white/80 dark:bg-dev-sidebar-dark/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between z-20 select-none">
      {/* Left: Mobile hamburger & Brand */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          aria-label={isMobileSidebarOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileSidebarOpen}
        >
          {isMobileSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-sky-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-500 dark:text-indigo-400 shadow-sm shadow-indigo-500/10">
            <Code2 className="w-4 h-4" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold tracking-tight text-base sm:text-lg text-slate-900 dark:text-white font-sans">
              Dev<span className="text-indigo-600 dark:text-indigo-400">Shelf</span>
            </span>
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/50">
              v0.4
            </span>
          </div>
        </div>
      </div>

      {/* Middle: Functional Search Input with Command Palette trigger */}
      <div className="flex-1 max-w-md mx-3 sm:mx-6 hidden sm:block">
        <div className="relative w-full flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-slate-400 dark:text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery || ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search snippets, code, tags, languages..."
            className="w-full pl-8 pr-16 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner transition-colors"
          />
          <div className="absolute right-2 flex items-center gap-1.5">
            {searchQuery && (
              <button
                type="button"
                onClick={onClearSearch}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden md:flex items-center gap-0.5 font-mono text-[10px] bg-white dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700 shadow-2xs select-none cursor-pointer transition-colors"
              title="Open Command Palette (Ctrl+K)"
              aria-label="Open Command Palette"
            >
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right: New Snippet, Storage pill & Theme switch */}
      <div className="flex items-center gap-2">
        {/* New Snippet button */}
        {onNewSnippet && (
          <button
            type="button"
            onClick={onNewSnippet}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-500/20 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Snippet</span>
          </button>
        )}

        {/* Backup Import / Export buttons */}
        <div className="flex items-center gap-1 border-l border-slate-200 dark:border-slate-800 pl-1.5 ml-0.5">
          {onOpenImport && (
            <button
              type="button"
              onClick={onOpenImport}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              title="Import JSON Backup"
              aria-label="Import JSON Backup"
            >
              <Upload className="w-4 h-4" />
            </button>
          )}

          {onExportJson && (
            <button
              type="button"
              onClick={onExportJson}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              title="Export All JSON"
              aria-label="Export All JSON"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Online / Offline & Storage status pill */}
        {!isOnline ? (
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50 animate-pulse"
            title="Operating offline. All snippet changes persist locally in IndexedDB."
            aria-label="Offline Mode Active"
          >
            <WifiOff className="w-3 h-3 text-amber-500" />
            <span className="font-mono text-[11px]">Offline (IndexedDB)</span>
          </div>
        ) : (
          <div 
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
            title="IndexedDB local persistent store"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <Database className="w-3 h-3" />
            <span className="font-mono text-[11px]">IndexedDB Active</span>
          </div>
        )}

        {/* Theme Switcher Dropdown */}
        <div className="relative" ref={themeMenuRef}>
          <button
            type="button"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            aria-label="Toggle theme"
            title={`Current theme: ${theme} (resolved: ${resolvedTheme})`}
            aria-expanded={isThemeMenuOpen}
          >
            {theme === 'system' ? (
              <Monitor className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            ) : resolvedTheme === 'dark' ? (
              <Moon className="w-4 h-4 text-indigo-400" />
            ) : (
              <Sun className="w-4 h-4 text-amber-500" />
            )}
          </button>

          {isThemeMenuOpen && (
            <div 
              className="absolute right-0 mt-1.5 w-36 py-1 bg-white dark:bg-dev-sidebar-dark rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 text-xs z-50 animate-in fade-in slide-in-from-top-1 duration-150"
              role="menu"
            >
              <div className="px-3 py-1 font-semibold text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800/80 mb-1">
                Appearance
              </div>
              <button
                type="button"
                onClick={() => { setTheme('light'); setIsThemeMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  theme === 'light' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 font-medium' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                role="menuitem"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => { setTheme('dark'); setIsThemeMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  theme === 'dark' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 font-medium' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                role="menuitem"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark (Charcoal)</span>
              </button>
              <button
                type="button"
                onClick={() => { setTheme('system'); setIsThemeMenuOpen(false); }}
                className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                  theme === 'system' 
                    ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/40 font-medium' 
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
                role="menuitem"
              >
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                <span>System</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
