/**
 * Export utilities for DevShelf
 * Formats snippets into a versioned JSON backup and handles safe download & URL cleanup.
 */

export const BACKUP_APP_ID = 'DevShelf';
export const CURRENT_SCHEMA_VERSION = '1.0.0';

/**
 * Exports snippet collection to a downloadable JSON file.
 * 
 * @param {Array<Object>} [snippets=[]] - Array of snippet records from IndexedDB
 * @returns {{ fileName: string, count: number, sensitiveCount: number }}
 */
export function exportSnippetsToJson(snippets = []) {
  const safeList = Array.isArray(snippets) ? snippets : [];

  // Sanitize each record to only valid schema properties
  const sanitizedSnippets = safeList.map((s) => ({
    id: s.id,
    title: s.title || 'Untitled Snippet',
    code: s.code || '',
    language: s.language || 'javascript',
    tags: Array.isArray(s.tags) ? s.tags : [],
    folder: s.folder || 'General',
    isPinned: Boolean(s.isPinned),
    hasSensitiveData: Boolean(s.hasSensitiveData),
    maskedCode: s.maskedCode || null,
    createdAt: s.createdAt || Date.now(),
    updatedAt: s.updatedAt || Date.now(),
  }));

  const exportPayload = {
    app: BACKUP_APP_ID,
    version: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    count: sanitizedSnippets.length,
    snippets: sanitizedSnippets,
  };

  let jsonString;
  try {
    jsonString = JSON.stringify(exportPayload, null, 2);
  } catch (err) {
    throw new Error(`Failed to serialize backup JSON: ${err.message || 'Serialization error'}`);
  }

  // Safe filename with date formatting
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `devshelf-backup-${dateStr}.json`;

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Revoke object URL after download trigger to prevent memory leaks
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1500);
  }

  const sensitiveCount = sanitizedSnippets.filter((s) => Boolean(s.hasSensitiveData)).length;
  return { fileName, count: sanitizedSnippets.length, sensitiveCount };
}
