/**
 * Tag normalization utilities for DevShelf
 * Cleans, trims, lowercases, and removes leading hash symbols.
 */

/**
 * Normalizes a single tag string.
 * Trims surrounding whitespace, lowercases, and removes leading '#' characters.
 * @param {string} tag
 * @returns {string}
 */
export function normalizeTag(tag) {
  if (!tag || typeof tag !== 'string') return '';
  return tag
    .trim()
    .toLowerCase()
    .replace(/^#+/, '')
    .trim();
}

/**
 * Normalizes an array of tags, removing duplicates and empty items.
 * @param {Array<string>} tags
 * @returns {Array<string>}
 */
export function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const set = new Set();
  tags.forEach((t) => {
    const normalized = normalizeTag(t);
    if (normalized.length > 0) {
      set.add(normalized);
    }
  });
  return Array.from(set);
}
