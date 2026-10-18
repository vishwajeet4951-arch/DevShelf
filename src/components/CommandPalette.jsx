import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Moon, 
  Sun, 
  Download, 
  Upload,
  FileCode2, 
  CornerDownLeft, 
  X,
  Folder,
  Tag as TagIcon
} from 'lucide-react';
import { searchSnippets } from '../utils/filterUtils.js';
import { useTheme } from '../context/useTheme.js';

export default function CommandPalette({
  isOpen,
  onClose,
  snippets = [],
  onSelectSnippet,
  onNewSnippet,
  onExportJson,
  onOpenImport,
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Define available commands
  const commands = useMemo(() => {
    return [
      {
        id: 'cmd-new',
        type: 'command',
        title: 'New Snippet',
        subtitle: 'Create a new code snippet in IndexedDB',
        icon: Plus,
        iconColor: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60',
        action: () => {
          onClose();
          onNewSnippet();
        },
      },
      {
        id: 'cmd-theme',
        type: 'command',
        title: resolvedTheme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme',
        subtitle: `Currently in ${theme} mode`,
        icon: resolvedTheme === 'dark' ? Sun : Moon,
        iconColor: resolvedTheme === 'dark' ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60' : 'text-indigo-400 bg-indigo-950/60',
        action: () => {
          setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
        },
      },
      {
        id: 'cmd-export',
        type: 'command',
        title: 'Export All JSON',
        subtitle: `Download backup of all ${snippets.length} snippets`,
        icon: Download,
        iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/60',
        action: () => {
          onClose();
          onExportJson();
        },
      },
      {
        id: 'cmd-import',
        type: 'command',
        title: 'Import JSON Backup',
        subtitle: 'Restore or merge snippets from a JSON backup file',
        icon: Upload,
        iconColor: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/60',
        action: () => {
          onClose();
          onOpenImport?.();
        },
      },
    ];
  }, [resolvedTheme, theme, snippets.length, onClose, onNewSnippet, onExportJson, onOpenImport, setTheme]);

  // Compute filtered commands and snippets
  const { filteredCommands, filteredSnippets, navigableItems } = useMemo(() => {
    const isCommandMode = query.startsWith('>');
    const cleanQuery = isCommandMode ? query.slice(1).trim() : query.trim();

    let cmdList = [];
    if (!cleanQuery) {
      cmdList = commands;
    } else {
      cmdList = commands.filter((c) =>
        c.title.toLowerCase().includes(cleanQuery.toLowerCase())
      );
    }

    let snipList = [];
    if (!isCommandMode) {
      if (!cleanQuery) {
        // Show up to 6 most recently updated snippets when query is empty
        snipList = snippets.slice(0, 6).map((s) => ({ ...s, type: 'snippet' }));
      } else {
        snipList = searchSnippets(snippets, cleanQuery)
          .slice(0, 8)
          .map((s) => ({ ...s, type: 'snippet' }));
      }
    }

    const items = [...cmdList, ...snipList];
    return {
      filteredCommands: cmdList,
      filteredSnippets: snipList,
      navigableItems: items,
    };
  }, [query, commands, snippets]);

  // Safe clamped index derived during render
  const safeIndex = navigableItems.length === 0 ? 0 : Math.min(selectedIndex, navigableItems.length - 1);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeElement = listRef.current.querySelector('[aria-selected="true"]');
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [safeIndex]);

  // Global Escape key handler
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onClose]);

  // Keyboard navigation inside palette
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (navigableItems.length > 0) {
        setSelectedIndex((safeIndex + 1) % navigableItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (navigableItems.length > 0) {
        setSelectedIndex((safeIndex - 1 + navigableItems.length) % navigableItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedItem = navigableItems[safeIndex];
      if (selectedItem) {
        if (selectedItem.type === 'command') {
          selectedItem.action();
        } else {
          onSelectSnippet(selectedItem);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      // Focus trapping: keep focus on the search input
      e.preventDefault();
      inputRef.current?.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-3 sm:p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Dialog */}
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-dev-sidebar-dark rounded-xl border border-slate-200 dark:border-dev-sidebar-border shadow-2xl overflow-hidden z-10 flex flex-col max-h-[75vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-label="Command Palette"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Box */}
        <div className="p-3 sm:p-3.5 border-b border-slate-200 dark:border-dev-sidebar-border flex items-center gap-2.5 bg-slate-50/50 dark:bg-slate-900/30">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={navigableItems[safeIndex] ? `option-${navigableItems[safeIndex].id}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Type a command or search snippets... (type > for commands)"
            className="cmd-palette-input flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            spellCheck="false"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
              aria-label="Clear palette search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 select-none">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Suggestions"
          className="flex-1 overflow-y-auto p-2 space-y-4"
        >
          {navigableItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No commands or snippets found for "{query}"
            </div>
          ) : (
            <>
              {/* Commands Group */}
              {filteredCommands.length > 0 && (
                <div>
                  <div className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Commands
                  </div>
                  <div className="space-y-0.5">
                    {filteredCommands.map((cmd) => {
                      const itemIndex = navigableItems.findIndex((it) => it.id === cmd.id);
                      const isSelected = itemIndex === safeIndex;
                      const Icon = cmd.icon;

                      return (
                        <div
                          key={cmd.id}
                          id={`option-${cmd.id}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => cmd.action()}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${cmd.iconColor}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <span className="font-medium text-slate-900 dark:text-white">
                                {cmd.title}
                              </span>
                              <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                                {cmd.subtitle}
                              </span>
                            </div>
                          </div>
                          {isSelected && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Snippets Group */}
              {filteredSnippets.length > 0 && (
                <div>
                  <div className="px-2.5 pb-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
                    <span>Snippets</span>
                    <span className="lowercase">{filteredSnippets.length} matches</span>
                  </div>
                  <div className="space-y-0.5">
                    {filteredSnippets.map((snippet) => {
                      const itemIndex = navigableItems.findIndex((it) => it.id === snippet.id);
                      const isSelected = itemIndex === safeIndex;

                      return (
                        <div
                          key={snippet.id}
                          id={`option-${snippet.id}`}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => onSelectSnippet(snippet)}
                          className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0">
                              <FileCode2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900 dark:text-white truncate">
                                  {snippet.title}
                                </span>
                                <span className="px-1.5 py-0.2 rounded font-mono text-[9px] uppercase bg-slate-100 dark:bg-slate-800 text-slate-500">
                                  {snippet.language}
                                </span>
                                {snippet.hasSensitiveData && (
                                  <span className="px-1.5 py-0.2 rounded font-mono text-[9px] uppercase bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                                    Sensitive
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                {snippet.folder && (
                                  <span className="flex items-center gap-0.5">
                                    <Folder className="w-2.5 h-2.5" />
                                    <span>{snippet.folder}</span>
                                  </span>
                                )}
                                {snippet.tags && snippet.tags.length > 0 && (
                                  <span className="flex items-center gap-0.5 truncate">
                                    <TagIcon className="w-2.5 h-2.5" />
                                    <span>#{snippet.tags.slice(0, 2).join(' #')}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500 shrink-0 ml-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Keyboard Navigation Shortcuts */}
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-dev-sidebar-border text-[11px] font-mono text-slate-400 flex items-center justify-between select-none">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">↑</kbd>
              <kbd className="px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">↓</kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300">↵</kbd>
              <span>select</span>
            </span>
          </div>
          <span className="hidden sm:inline text-slate-500">
            Type <span className="text-indigo-500 font-bold">&gt;</span> for commands only
          </span>
        </div>
      </div>
    </div>
  );
}
