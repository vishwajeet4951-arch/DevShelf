/**
 * DevShelf IndexedDB Service
 * Native Promise-based IndexedDB database wrapper.
 * Database: devshelf-db
 * Object Store: snippets (keyPath: 'id')
 */

import { normalizeTags } from '../utils/tagUtils.js';
import { computeSensitiveMetadata } from '../utils/masker.js';

const DB_NAME = 'devshelf-db';
const DB_VERSION = 1;
const STORE_NAME = 'snippets';

// Allowed default languages
export const SUPPORTED_LANGUAGES = [
  'javascript',
  'python',
  'sql',
  'css',
  'bash',
  'json',
  'html',
  'markdown',
];

/**
 * Generates a standard UUID v4.
 * Uses crypto.randomUUID() when available, with a compliant fallback.
 */
export function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Opens a connection to the IndexedDB database.
 * Sets up the schema and indexes during upgradeneeded.
 * @returns {Promise<IDBDatabase>}
 */
export function openDB() {
  return new Promise((resolve, reject) => {
    const idb = typeof window !== 'undefined' ? window.indexedDB : (typeof globalThis !== 'undefined' ? globalThis.indexedDB : null);
    if (!idb) {
      reject(new Error('IndexedDB is not supported in this environment.'));
      return;
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

        // Create useful query and filter indexes
        store.createIndex('by_language', 'language', { unique: false });
        store.createIndex('by_folder', 'folder', { unique: false });
        store.createIndex('by_isPinned', 'isPinned', { unique: false });
        store.createIndex('by_createdAt', 'createdAt', { unique: false });
        store.createIndex('by_updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open IndexedDB "${DB_NAME}": ${event.target.error?.message || 'Unknown error'}`));
    };

    request.onblocked = () => {
      console.warn(`IndexedDB database "${DB_NAME}" upgrade blocked. Please close other open tabs.`);
    };
  });
}

/**
 * Helper to run a transaction and return the store request result.
 * @param {'readonly'|'readwrite'} mode
 * @param {(store: IDBObjectStore) => IDBRequest} operation
 * @returns {Promise<any>}
 */
async function executeTransaction(mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);

      let result;
      const request = operation(store);

      if (request) {
        request.onsuccess = (e) => {
          result = e.target.result;
        };
        request.onerror = (e) => {
          reject(new Error(`IndexedDB request error: ${e.target.error?.message || 'Unknown error'}`));
        };
      }

      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };

      tx.onerror = (e) => {
        db.close();
        reject(new Error(`Transaction failed: ${e.target.error?.message || 'Unknown error'}`));
      };

      tx.onabort = (e) => {
        db.close();
        reject(new Error(`Transaction aborted: ${e.target.error?.message || 'Aborted'}`));
      };
    } catch (err) {
      db.close();
      reject(err);
    }
  });
}

/**
 * Validates snippet payload fields.
 * Throws an Error with descriptive message if invalid.
 */
function validateSnippetData(data, isEdit = false) {
  if (!data || typeof data !== 'object') {
    throw new Error('Snippet data must be an object.');
  }

  const trimmedTitle = (data.title || '').trim();
  if (!trimmedTitle) {
    throw new Error('Snippet title is required and cannot be empty.');
  }

  if (typeof data.code !== 'string' || data.code.trim().length === 0) {
    throw new Error('Snippet code is required and cannot be empty.');
  }

  const lang = (data.language || 'javascript').toLowerCase().trim();
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    throw new Error(`Unsupported language "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}.`);
  }

  if (isEdit && !data.id) {
    throw new Error('Cannot update snippet without a valid id.');
  }
}

/**
 * Creates and persists a new snippet record.
 * @param {Object} snippetData
 * @returns {Promise<Object>} The created snippet
 */
export async function createSnippet(snippetData) {
  validateSnippetData(snippetData, false);

  const { hasSensitiveData, maskedCode } = computeSensitiveMetadata(snippetData.code);
  const now = Date.now();
  const newSnippet = {
    id: snippetData.id || generateUUID(),
    title: snippetData.title.trim(),
    code: snippetData.code,
    language: (snippetData.language || 'javascript').toLowerCase().trim(),
    tags: normalizeTags(snippetData.tags),
    folder: (snippetData.folder || 'General').trim() || 'General',
    isPinned: Boolean(snippetData.isPinned),
    hasSensitiveData,
    maskedCode,
    createdAt: now,
    updatedAt: now,
  };

  await executeTransaction('readwrite', (store) => store.add(newSnippet));
  return newSnippet;
}

/**
 * Retrieves a single snippet by ID.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getSnippetById(id) {
  if (!id) throw new Error('Snippet ID is required to getSnippetById.');
  const result = await executeTransaction('readonly', (store) => store.get(id));
  return result || null;
}

/**
 * Retrieves all snippets stored in IndexedDB.
 * Returns sorted by updatedAt descending.
 * @returns {Promise<Array<Object>>}
 */
export async function getAllSnippets() {
  const snippets = await executeTransaction('readonly', (store) => store.getAll());
  if (!Array.isArray(snippets)) return [];
  // Sort descending by updatedAt (newest first)
  return snippets.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Updates an existing snippet. Preserves original createdAt and id.
 * Updates updatedAt to current timestamp.
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>} The updated snippet
 */
export async function updateSnippet(id, updates) {
  if (!id) throw new Error('Snippet ID is required to updateSnippet.');

  // Fetch existing record first to guarantee existence and preserve creation metadata
  const existing = await getSnippetById(id);
  if (!existing) {
    throw new Error(`Snippet with id "${id}" does not exist.`);
  }

  const payload = {
    ...existing,
    ...updates,
    id, // Always preserve original ID
  };

  validateSnippetData(payload, true);

  const codeToSave = payload.code !== undefined ? payload.code : existing.code;
  const { hasSensitiveData, maskedCode } = computeSensitiveMetadata(codeToSave);

  const updatedSnippet = {
    id: existing.id,
    title: payload.title.trim(),
    code: codeToSave,
    language: (payload.language || existing.language || 'javascript').toLowerCase().trim(),
    tags: payload.tags !== undefined ? normalizeTags(payload.tags) : existing.tags || [],
    folder: (payload.folder !== undefined ? payload.folder : existing.folder).trim() || 'General',
    isPinned: payload.isPinned !== undefined ? Boolean(payload.isPinned) : existing.isPinned,
    hasSensitiveData,
    maskedCode,
    createdAt: existing.createdAt || Date.now(), // Preserve original creation timestamp
    updatedAt: Date.now(), // Bump updated timestamp
  };

  await executeTransaction('readwrite', (store) => store.put(updatedSnippet));
  return updatedSnippet;
}

/**
 * Deletes a snippet by ID.
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteSnippet(id) {
  if (!id) throw new Error('Snippet ID is required to deleteSnippet.');
  
  // Verify existence first
  const existing = await getSnippetById(id);
  if (!existing) {
    throw new Error(`Snippet with id "${id}" not found.`);
  }

  await executeTransaction('readwrite', (store) => store.delete(id));
  return true;
}

/**
 * Duplicates a snippet with a fresh UUID, "(Copy)" title suffix,
 * and current timestamps.
 * @param {string} id
 * @returns {Promise<Object>} The duplicated snippet
 */
export async function duplicateSnippet(id) {
  if (!id) throw new Error('Snippet ID is required to duplicateSnippet.');

  const original = await getSnippetById(id);
  if (!original) {
    throw new Error(`Snippet with id "${id}" not found.`);
  }

  const now = Date.now();
  const duplicated = {
    ...original,
    id: generateUUID(),
    title: `${original.title} (Copy)`,
    isPinned: false, // Cloned snippet starts unpinned
    createdAt: now,
    updatedAt: now,
  };

  await executeTransaction('readwrite', (store) => store.add(duplicated));
  return duplicated;
}

/**
 * Toggles the pinned state of a snippet.
 * @param {string} id
 * @returns {Promise<Object>} The updated snippet
 */
export async function toggleSnippetPin(id) {
  if (!id) throw new Error('Snippet ID is required to toggleSnippetPin.');

  const existing = await getSnippetById(id);
  if (!existing) {
    throw new Error(`Snippet with id "${id}" not found.`);
  }

  const updatedSnippet = {
    ...existing,
    isPinned: !existing.isPinned,
    updatedAt: Date.now(),
  };

  await executeTransaction('readwrite', (store) => store.put(updatedSnippet));
  return updatedSnippet;
}

/**
 * Bulk imports snippets into IndexedDB in either 'merge' or 'replace' mode.
 * 
 * - mode 'replace':
 *   Within a single atomic readwrite transaction, clears the store and adds all snippets.
 *   If any add operation fails, the transaction aborts and all previous snippets are preserved.
 * 
 * - mode 'merge':
 *   Within a single readwrite transaction, inspects conflicts:
 *   - conflictPolicy 'skip': keeps existing record, skips imported record with matching ID
 *   - conflictPolicy 'overwrite': puts imported record over existing record
 *   - conflictPolicy 'keep_both': assigns a new UUID to imported record and adds it
 * 
 * @param {Array<Object>} validatedSnippets
 * @param {Object} [options={}]
 * @param {'merge'|'replace'} [options.mode='merge']
 * @param {'skip'|'overwrite'|'keep_both'} [options.conflictPolicy='skip']
 * @returns {Promise<{ mode: string, addedCount: number, updatedCount: number, skippedCount: number, totalProcessed: number }>}
 */
export async function importSnippets(validatedSnippets, options = {}) {
  const mode = options.mode || 'merge';
  const conflictPolicy = options.conflictPolicy || 'skip';

  if (!Array.isArray(validatedSnippets)) {
    throw new Error('importSnippets expects an array of validated snippets.');
  }

  // Pre-fetch all existing snippets to identify conflict IDs before transaction
  const existingList = await getAllSnippets();
  const existingMap = new Map(existingList.map((s) => [s.id, s]));

  const db = await openDB();

  return new Promise((resolve, reject) => {
    let addedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => {
      resolve({
        mode,
        addedCount,
        updatedCount,
        skippedCount,
        totalProcessed: validatedSnippets.length,
      });
    };

    tx.onerror = () => {
      reject(new Error(`Import transaction failed: ${tx.error?.message || 'Transaction error'}`));
    };

    tx.onabort = () => {
      reject(new Error(`Import transaction was aborted: ${tx.error?.message || 'Transaction aborted'}`));
    };

    try {
      if (mode === 'replace') {
        // Clear all existing snippets in the store atomically
        store.clear();
        for (const snippet of validatedSnippets) {
          store.add(snippet);
          addedCount++;
        }
      } else {
        // Merge mode
        for (const snippet of validatedSnippets) {
          if (!existingMap.has(snippet.id)) {
            // New record
            store.add(snippet);
            addedCount++;
          } else {
            // Conflicting record
            if (conflictPolicy === 'skip') {
              skippedCount++;
            } else if (conflictPolicy === 'overwrite') {
              store.put(snippet);
              updatedCount++;
            } else if (conflictPolicy === 'keep_both') {
              const newSnippet = {
                ...snippet,
                id: generateUUID(),
                title: `${snippet.title} (Imported)`,
              };
              store.add(newSnippet);
              addedCount++;
            }
          }
        }
      }
    } catch (err) {
      tx.abort();
      reject(err);
    }
  });
}
