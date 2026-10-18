import React, { useMemo } from 'react';
import { 
  FileCode2, 
  Pin, 
  Star, 
  Folder, 
  Tag, 
  ChevronLeft, 
  ChevronRight, 
  Layers,
  ShieldCheck,
  ShieldAlert,
  HardDrive
} from 'lucide-react';
import { normalizeTag } from '../../utils/tagUtils';

const LANGUAGE_COLORS = {
  javascript: 'bg-amber-400',
  python: 'bg-sky-400',
  sql: 'bg-emerald-400',
  css: 'bg-indigo-400',
  bash: 'bg-purple-400',
  json: 'bg-orange-400',
  html: 'bg-rose-400',
  markdown: 'bg-slate-400',
};

export default function Sidebar({ 
  isMobileOpen, 
  onCloseMobile, 
  isCollapsed, 
  onToggleCollapse,
  activeFilter = 'all',
  onSelectFilter = () => {},
  snippets = [],
}) {
  // Compute counts dynamically from IndexedDB snippets
  const { allCount, pinnedCount, favoritesCount, sensitiveCount, foldersList, languagesList, tagsList } = useMemo(() => {
    const all = snippets.length;
    let pinned = 0;
    let favorites = 0;
    let sensitive = 0;
    const folderCounts = {};
    const langCounts = {};
    const tagCounts = {};

    snippets.forEach((s) => {
      if (s.isPinned) pinned++;
      if (s.isFavorite || s.isPinned) favorites++;
      if (s.hasSensitiveData) sensitive++;

      const f = (s.folder || 'General').trim();
      folderCounts[f] = (folderCounts[f] || 0) + 1;

      const lang = (s.language || 'javascript').toLowerCase();
      langCounts[lang] = (langCounts[lang] || 0) + 1;

      if (Array.isArray(s.tags)) {
        s.tags.forEach((t) => {
          const normalized = normalizeTag(t);
          if (normalized) tagCounts[normalized] = (tagCounts[normalized] || 0) + 1;
        });
      }
    });

    // Ensure at least "General" exists in folders if empty
    if (Object.keys(folderCounts).length === 0) {
      folderCounts['General'] = 0;
    }

    const folders = Object.entries(folderCounts).map(([name, count]) => ({
      id: name.toLowerCase(),
      name,
      count,
    }));

    const defaultLanguages = ['javascript', 'python', 'sql', 'bash', 'json', 'css'];
    const langs = defaultLanguages.map((lang) => ({
      id: lang,
      name: lang.charAt(0).toUpperCase() + lang.slice(1),
      count: langCounts[lang] || 0,
      color: LANGUAGE_COLORS[lang] || 'bg-slate-400',
    }));

    const tags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      allCount: all,
      pinnedCount: pinned,
      favoritesCount: favorites,
      sensitiveCount: sensitive,
      foldersList: folders,
      languagesList: langs,
      tagsList: tags,
    };
  }, [snippets]);

  const mainNavItems = [
    { id: 'all', label: 'All Snippets', icon: FileCode2, count: allCount },
    { id: 'pinned', label: 'Pinned', icon: Pin, count: pinnedCount },
    { id: 'favorites', label: 'Favorites', icon: Star, count: favoritesCount },
  ];

  if (sensitiveCount > 0) {
    mainNavItems.push({
      id: 'sensitive',
      label: 'Sensitive Data',
      icon: ShieldAlert,
      count: sensitiveCount,
    });
  }

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Sidebar Top: Collapse Toggle Header (desktop only) */}
      <div className="hidden md:flex items-center justify-between px-3.5 py-3 border-b border-dev-sidebar-lightBorder dark:border-dev-sidebar-border">
        {!isCollapsed && (
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Library</span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition-colors ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links Scrollable Area */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-5">
        {/* Main Section */}
        <div>
          {!isCollapsed && (
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overview
            </div>
          )}
          <nav className="space-y-0.5">
            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectFilter(item.id)}
                  title={isCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                  } ${isCollapsed ? 'justify-center px-1' : ''}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left truncate">{item.label}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        isActive 
                          ? 'bg-indigo-100/70 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300' 
                          : 'bg-slate-100 dark:bg-slate-800/80 text-slate-500'
                      }`}>
                        {item.count}
                      </span>
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Folders Section */}
        {!isCollapsed && (
          <div>
            <div className="px-2 pb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>Folders</span>
              <span className="text-[10px] font-mono lowercase">
                {foldersList.length} {foldersList.length === 1 ? 'folder' : 'folders'}
              </span>
            </div>
            <div className="space-y-0.5">
              {foldersList.map((folder) => {
                const isActive = activeFilter === `folder:${folder.id}`;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onSelectFilter(`folder:${folder.id}`)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                    <span className="flex-1 text-left truncate">{folder.name}</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                      {folder.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Languages Section */}
        {!isCollapsed && (
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Languages
            </div>
            <div className="space-y-0.5">
              {languagesList.map((lang) => {
                const isActive = activeFilter === `lang:${lang.id}`;
                return (
                  <button
                    key={lang.id}
                    type="button"
                    onClick={() => onSelectFilter(`lang:${lang.id}`)}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${lang.color} shrink-0`} />
                    <span className="flex-1 text-left truncate">{lang.name}</span>
                    {lang.count > 0 && (
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                        {lang.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags Section */}
        {!isCollapsed && (
          <div>
            <div className="px-2 pb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Tag className="w-3 h-3 text-slate-400" />
              <span>Tags</span>
            </div>
            {tagsList.length > 0 ? (
              <div className="px-2 flex flex-wrap gap-1.5 pt-1">
                {tagsList.map((tag) => {
                  const isActive = activeFilter === `tag:${tag.name}`;
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => onSelectFilter(`tag:${tag.name}`)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                        isActive
                          ? 'bg-indigo-500 text-white font-medium shadow-2xs'
                          : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400'
                      }`}
                    >
                      <span>#{tag.name}</span>
                      <span className={`text-[9px] ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>({tag.count})</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-2 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                No tags yet
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sidebar Footer: System & Persistence Indicator */}
      <div className="p-3 border-t border-dev-sidebar-lightBorder dark:border-dev-sidebar-border bg-slate-50/50 dark:bg-slate-900/40">
        {!isCollapsed ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
                <span>Local Storage</span>
              </span>
              <span className="font-mono text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold">IndexedDB</span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500">
              <ShieldCheck className="w-3 h-3 text-sky-400" />
              <span>{allCount} {allCount === 1 ? 'snippet' : 'snippets'} stored locally</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title={`${allCount} snippets stored in local IndexedDB`}>
            <HardDrive className="w-4 h-4 text-indigo-500" />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside 
        className={`hidden md:block shrink-0 transition-all duration-200 ease-in-out border-r border-dev-sidebar-lightBorder dark:border-dev-sidebar-border bg-dev-sidebar-light dark:bg-dev-sidebar-dark ${
          isCollapsed ? 'w-16' : 'w-60 lg:w-64'
        }`}
        aria-label="Sidebar navigation"
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop & Drawer */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 md:hidden bg-slate-900/60 dark:bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <div 
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] md:hidden bg-dev-sidebar-light dark:bg-dev-sidebar-dark border-r border-dev-sidebar-lightBorder dark:border-dev-sidebar-border shadow-2xl transform transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation drawer"
        aria-hidden={!isMobileOpen}
      >
        {sidebarContent}
      </div>
    </>
  );
}
