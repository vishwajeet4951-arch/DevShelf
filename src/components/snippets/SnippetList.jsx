import React, { useState, useMemo } from 'react';
import SnippetCard from './SnippetCard';
import EmptyState from './EmptyState';
import { 
  Plus, 
  Loader2, 
  Search, 
  X, 
  ArrowUpDown, 
  Filter, 
  Pin, 
  Folder, 
  Tag as TagIcon,
  Code2
} from 'lucide-react';
import { filterAndSortSnippets } from '../../utils/filterUtils';

export default function SnippetList({
  snippets = [],
  loading = false,
  activeFilter = 'all',
  searchQuery = '',
  onSearchChange,
  onClearSearch,
  onSelectFilter,
  onNewSnippet,
  onSelectSnippet,
  onEdit,
  onDelete,
  onDuplicate,
  onTogglePin,
  onCopy,
}) {
  const [sortBy, setSortBy] = useState('updated_desc');
  const [pinnedFirst, setPinnedFirst] = useState(true);

  // Parse activeFilter into filter options
  const filterOptions = useMemo(() => {
    let folder = null;
    let language = null;
    let tag = null;
    let pinnedOnly = false;
    let sensitiveOnly = false;

    if (activeFilter === 'pinned') pinnedOnly = true;
    if (activeFilter === 'favorites') pinnedOnly = true;
    if (activeFilter === 'sensitive') sensitiveOnly = true;
    if (activeFilter.startsWith('folder:')) {
      folder = activeFilter.replace('folder:', '');
    }
    if (activeFilter.startsWith('lang:')) {
      language = activeFilter.replace('lang:', '');
    }
    if (activeFilter.startsWith('tag:')) {
      tag = activeFilter.replace('tag:', '');
    }

    return { folder, language, tag, pinnedOnly, sensitiveOnly };
  }, [activeFilter]);

  // Combined instant search and filter
  const filteredAndSortedSnippets = useMemo(() => {
    return filterAndSortSnippets(snippets, {
      searchQuery,
      folder: filterOptions.folder,
      language: filterOptions.language,
      tag: filterOptions.tag,
      pinnedOnly: filterOptions.pinnedOnly,
      sensitiveOnly: filterOptions.sensitiveOnly,
      sortBy,
      pinnedFirst,
    });
  }, [snippets, searchQuery, filterOptions, sortBy, pinnedFirst]);

  // Handle active filter chip removal
  const handleClearActiveFilter = () => {
    onSelectFilter?.('all');
  };

  const handleResetAll = () => {
    onClearSearch?.();
    onSelectFilter?.('all');
  };

  const getFilterBadgeLabel = () => {
    if (activeFilter === 'pinned') return { type: 'pinned', label: 'Pinned Only' };
    if (activeFilter === 'favorites') return { type: 'favorites', label: 'Favorites' };
    if (activeFilter === 'sensitive') return { type: 'sensitive', label: 'Sensitive Data' };
    if (activeFilter.startsWith('folder:')) {
      const name = activeFilter.replace('folder:', '');
      return { type: 'folder', label: `Folder: ${name.charAt(0).toUpperCase() + name.slice(1)}` };
    }
    if (activeFilter.startsWith('lang:')) {
      const lang = activeFilter.replace('lang:', '');
      return { type: 'lang', label: `Language: ${lang.toUpperCase()}` };
    }
    if (activeFilter.startsWith('tag:')) {
      const tag = activeFilter.replace('tag:', '');
      return { type: 'tag', label: `Tag: #${tag}` };
    }
    return null;
  };

  const activeBadge = getFilterBadgeLabel();
  const hasActiveFiltersOrSearch = Boolean(searchQuery.trim() || activeBadge);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-xs font-mono">Loading snippets from IndexedDB...</p>
      </div>
    );
  }

  // Case 1: Database has 0 snippets
  if (snippets.length === 0) {
    return (
      <EmptyState 
        activeFilter={activeFilter} 
        onNewSnippet={onNewSnippet} 
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
      {/* Workspace Toolbar */}
      <div className="p-3 sm:px-6 border-b border-dev-sidebar-lightBorder dark:border-dev-sidebar-border bg-white/60 dark:bg-dev-sidebar-dark/60 backdrop-blur-xs flex flex-col gap-2.5 shrink-0 select-none">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Left: Mobile Search & Title / Count */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            {/* Inline Search Bar on small screens, or quick filter indicator */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Filter in view..."
                className="w-full pl-8 pr-7 py-1 rounded-md text-xs bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
              {filteredAndSortedSnippets.length} of {snippets.length}
            </span>
          </div>

          {/* Right: Sort controls & New Snippet button */}
          <div className="flex items-center gap-2">
            {/* Sort selector */}
            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
              <ArrowUpDown className="w-3 h-3 text-slate-400 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-medium text-slate-700 dark:text-slate-300 border-none focus:outline-none cursor-pointer pr-1"
                aria-label="Sort snippets by"
              >
                <option value="updated_desc" className="dark:bg-slate-900">Recently Updated</option>
                <option value="created_desc" className="dark:bg-slate-900">Recently Created</option>
                <option value="title_asc" className="dark:bg-slate-900">Title (A-Z)</option>
                <option value="title_desc" className="dark:bg-slate-900">Title (Z-A)</option>
                <option value="updated_asc" className="dark:bg-slate-900">Oldest Updated</option>
              </select>
            </div>

            {/* Pinned first toggle */}
            <button
              type="button"
              onClick={() => setPinnedFirst(!pinnedFirst)}
              className={`p-1.5 rounded-md border text-xs transition-colors ${
                pinnedFirst
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800/40'
                  : 'text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={pinnedFirst ? "Pinned items shown first" : "Pinned items not prioritized"}
              aria-label="Toggle pin-first sorting"
            >
              <Pin className={`w-3.5 h-3.5 ${pinnedFirst ? 'fill-amber-500' : ''}`} />
            </button>

            {/* New Snippet Button */}
            <button
              type="button"
              onClick={onNewSnippet}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Snippet</span>
            </button>
          </div>
        </div>

        {/* Active Filter Chips Bar (if search or filter active) */}
        {hasActiveFiltersOrSearch && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs animate-in fade-in duration-150">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Active filters:</span>
            </span>

            {/* Search query chip */}
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50">
                <Search className="w-2.5 h-2.5" />
                <span>Search: "{searchQuery}"</span>
                <button
                  type="button"
                  onClick={onClearSearch}
                  className="hover:text-rose-500 p-0.5"
                  aria-label="Remove search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Filter badge chip */}
            {activeBadge && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {activeBadge.type === 'pinned' && <Pin className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />}
                {activeBadge.type === 'folder' && <Folder className="w-2.5 h-2.5 text-slate-400" />}
                {activeBadge.type === 'lang' && <Code2 className="w-2.5 h-2.5 text-indigo-400" />}
                {activeBadge.type === 'tag' && <TagIcon className="w-2.5 h-2.5 text-slate-400" />}
                <span>{activeBadge.label}</span>
                <button
                  type="button"
                  onClick={handleClearActiveFilter}
                  className="hover:text-rose-500 p-0.5"
                  aria-label="Remove category filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {/* Reset All Filters button */}
            <button
              type="button"
              onClick={handleResetAll}
              className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Case 2 & 3: Filter / Search returned 0 matches */}
      {filteredAndSortedSnippets.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-200">
          <div className="max-w-sm w-full p-6 rounded-2xl bg-white dark:bg-dev-sidebar-dark border border-slate-200 dark:border-dev-sidebar-border shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 mx-auto mb-3">
              {searchQuery ? <Search className="w-6 h-6" /> : <Filter className="w-6 h-6" />}
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              {searchQuery ? 'No matching snippets found' : 'No snippets match selected filters'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              {searchQuery 
                ? `No snippets match your search for "${searchQuery}". Check for typos or try broader keywords.`
                : 'No snippets were found with the active folder, language, or tag filters.'
              }
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleResetAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors"
              >
                Clear all filters
              </button>
              <button
                type="button"
                onClick={onNewSnippet}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Snippet</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Case 4: Snippets List Grid */
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedSnippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onSelectSnippet={onSelectSnippet}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onTogglePin={onTogglePin}
              onSelectTag={(tag) => onSelectFilter?.(`tag:${tag}`)}
              onCopy={onCopy}
            />
          ))}
        </div>
      )}
    </div>
  );
}
