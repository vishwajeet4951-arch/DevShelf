/**
 * Filter, search, and sort utilities for DevShelf snippets
 */

import { normalizeTag } from './tagUtils.js';

/**
 * Performs case-insensitive substring search across title, code, folder, language, and tags.
 * @param {Array<Object>} snippets
 * @param {string} query
 * @returns {Array<Object>}
 */
export function searchSnippets(snippets, query) {
  if (!Array.isArray(snippets)) return [];
  const q = (query || '').toLowerCase().trim();
  if (!q) return snippets;

  return snippets.filter((s) => {
    // Title match
    if (s.title && s.title.toLowerCase().includes(q)) return true;

    // Code match
    if (s.code && s.code.toLowerCase().includes(q)) return true;

    // Folder match
    if (s.folder && s.folder.toLowerCase().includes(q)) return true;

    // Language match
    if (s.language && s.language.toLowerCase().includes(q)) return true;

    // Tags match
    if (Array.isArray(s.tags) && s.tags.some((t) => String(t).toLowerCase().includes(q))) {
      return true;
    }

    return false;
  });
}

/**
 * Combined filter and sort function.
 * @param {Array<Object>} snippets
 * @param {Object} options
 * @param {string} [options.searchQuery]
 * @param {string} [options.folder]
 * @param {string} [options.language]
 * @param {string} [options.tag]
 * @param {boolean} [options.pinnedOnly]
 * @param {boolean} [options.sensitiveOnly]
 * @param {string} [options.sortBy] 'updated_desc' | 'updated_asc' | 'created_desc' | 'title_asc' | 'title_desc'
 * @param {boolean} [options.pinnedFirst] default true
 * @returns {Array<Object>}
 */
export function filterAndSortSnippets(snippets, options = {}) {
  if (!Array.isArray(snippets)) return [];

  const {
    searchQuery = '',
    folder = null,
    language = null,
    tag = null,
    pinnedOnly = false,
    sensitiveOnly = false,
    sortBy = 'updated_desc',
    pinnedFirst = true,
  } = options;

  // 1. Instant search
  let result = searchSnippets(snippets, searchQuery);

  // 2. Folder filter
  if (folder && folder !== 'all') {
    const targetFolder = folder.toLowerCase().trim();
    result = result.filter((s) => (s.folder || 'General').toLowerCase().trim() === targetFolder);
  }

  // 3. Language filter
  if (language && language !== 'all') {
    const targetLang = language.toLowerCase().trim();
    result = result.filter((s) => (s.language || '').toLowerCase().trim() === targetLang);
  }

  // 4. Tag filter
  if (tag) {
    const targetTag = normalizeTag(tag);
    result = result.filter(
      (s) => Array.isArray(s.tags) && s.tags.some((t) => normalizeTag(t) === targetTag)
    );
  }

  // 5. Pinned-only filter
  if (pinnedOnly) {
    result = result.filter((s) => Boolean(s.isPinned));
  }

  // 6. Sensitive-data-only filter
  if (sensitiveOnly) {
    result = result.filter((s) => Boolean(s.hasSensitiveData));
  }

  // 7. Sort
  return [...result].sort((a, b) => {
    // If pinnedFirst is enabled and pin statuses differ, keep pinned on top
    if (pinnedFirst) {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
    }

    // Secondary sort
    switch (sortBy) {
      case 'updated_asc':
        return (a.updatedAt || 0) - (b.updatedAt || 0);
      case 'created_desc':
        return (b.createdAt || 0) - (a.createdAt || 0);
      case 'title_asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title_desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'updated_desc':
      default:
        return (b.updatedAt || 0) - (a.updatedAt || 0);
    }
  });
}
