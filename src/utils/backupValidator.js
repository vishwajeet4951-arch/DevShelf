/**
 * DevShelf Backup Validation & Normalization Engine
 * 
 * Validates, sanitizes, and normalizes DevShelf JSON backup files before
 * any write operations are committed to IndexedDB.
 */

import { SUPPORTED_LANGUAGES } from '../services/db.js';
import { normalizeTags } from './tagUtils.js';
import { computeSensitiveMetadata } from './masker.js';

export const BACKUP_APP_ID = 'DevShelf';
export const CURRENT_SCHEMA_VERSION = '1.0.0';
export const SUPPORTED_SCHEMA_VERSIONS = ['1.0.0', '1.0', '1'];

export const MAX_BACKUP_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_SNIPPETS_PER_BACKUP = 5000;
export const MAX_CODE_LENGTH = 500000; // 500 KB per snippet
export const MAX_TITLE_LENGTH = 300;
export const MAX_FOLDER_LENGTH = 100;

/**
 * Validates the raw JSON string or parsed object against DevShelf backup specification.
 * 
 * @param {string|Object} backupData - Raw JSON string or parsed backup payload
 * @param {Array<Object>} [existingSnippets=[]] - Currently stored snippets in IndexedDB
 * @returns {ValidationResult}
 */
export function validateBackup(backupData, existingSnippets = []) {
  const result = {
    isValid: false,
    app: null,
    version: null,
    exportedAt: null,
    totalInFile: 0,
    validCount: 0,
    invalidCount: 0,
    conflictingCount: 0,
    newCount: 0,
    sensitiveCount: 0,
    validSnippets: [],
    conflictingSnippets: [],
    newSnippets: [],
    errors: [],
    recordErrors: [],
  };

  // 1. Parse JSON if string was provided
  let payload;
  if (typeof backupData === 'string') {
    if (backupData.length > MAX_BACKUP_FILE_SIZE) {
      result.errors.push(`File exceeds maximum allowed size of 10 MB.`);
      return result;
    }
    try {
      payload = JSON.parse(backupData);
    } catch {
      result.errors.push('Malformed JSON file. Parsing failed.');
      return result;
    }
  } else if (backupData && typeof backupData === 'object') {
    payload = backupData;
  } else {
    result.errors.push('Invalid backup payload. Expected a JSON object.');
    return result;
  }

  // 2. Validate Top-Level Envelope
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    result.errors.push('Top-level backup structure must be a JSON object.');
    return result;
  }

  if (payload.app !== BACKUP_APP_ID) {
    result.errors.push(
      `Invalid application identifier "${payload.app || 'unknown'}". Expected "${BACKUP_APP_ID}".`
    );
    return result;
  }

  const versionStr = String(payload.version || '').trim();
  if (!SUPPORTED_SCHEMA_VERSIONS.includes(versionStr)) {
    result.errors.push(
      `Unsupported backup schema version "${versionStr || 'unknown'}". Supported: ${SUPPORTED_SCHEMA_VERSIONS.join(', ')}.`
    );
    return result;
  }

  if (!Array.isArray(payload.snippets)) {
    result.errors.push('Backup payload missing required "snippets" array.');
    return result;
  }

  if (payload.snippets.length > MAX_SNIPPETS_PER_BACKUP) {
    result.errors.push(
      `Backup contains ${payload.snippets.length} snippets, exceeding the limit of ${MAX_SNIPPETS_PER_BACKUP}.`
    );
    return result;
  }

  result.app = payload.app;
  result.version = versionStr;
  result.exportedAt = payload.exportedAt || new Date().toISOString();
  result.totalInFile = payload.snippets.length;

  // Handle empty backup collection gracefully
  if (payload.snippets.length === 0) {
    result.isValid = true;
    return result;
  }

  // 3. Validate and Normalize Records
  const seenFileIds = new Set();
  const existingIds = new Set((existingSnippets || []).map((s) => s.id));

  payload.snippets.forEach((rawSnippet, idx) => {
    const recordNum = idx + 1;

    if (!rawSnippet || typeof rawSnippet !== 'object' || Array.isArray(rawSnippet)) {
      result.recordErrors.push({
        index: idx,
        reason: `Record #${recordNum} is not a valid object.`,
      });
      result.invalidCount++;
      return;
    }

    // ID Validation
    const id = typeof rawSnippet.id === 'string' ? rawSnippet.id.trim() : '';
    if (!id) {
      result.recordErrors.push({
        index: idx,
        reason: `Record #${recordNum} is missing a required "id".`,
      });
      result.invalidCount++;
      return;
    }

    if (seenFileIds.has(id)) {
      result.recordErrors.push({
        index: idx,
        id,
        reason: `Record #${recordNum} contains duplicate ID "${id}" within the backup file.`,
      });
      result.invalidCount++;
      return;
    }
    seenFileIds.add(id);

    // Title Validation
    const title = typeof rawSnippet.title === 'string' ? rawSnippet.title.trim() : '';
    if (!title) {
      result.recordErrors.push({
        index: idx,
        id,
        reason: `Record #${recordNum} is missing a required "title".`,
      });
      result.invalidCount++;
      return;
    }
    if (title.length > MAX_TITLE_LENGTH) {
      result.recordErrors.push({
        index: idx,
        id,
        reason: `Record #${recordNum} title exceeds max length of ${MAX_TITLE_LENGTH} characters.`,
      });
      result.invalidCount++;
      return;
    }

    // Code Validation
    const code = typeof rawSnippet.code === 'string' ? rawSnippet.code : '';
    if (!code || code.trim().length === 0) {
      result.recordErrors.push({
        index: idx,
        id,
        reason: `Record #${recordNum} has empty or missing code content.`,
      });
      result.invalidCount++;
      return;
    }
    if (code.length > MAX_CODE_LENGTH) {
      result.recordErrors.push({
        index: idx,
        id,
        reason: `Record #${recordNum} code exceeds max length limit of ${MAX_CODE_LENGTH} characters.`,
      });
      result.invalidCount++;
      return;
    }

    // Language Validation
    const language = typeof rawSnippet.language === 'string' 
      ? rawSnippet.language.toLowerCase().trim() 
      : 'javascript';
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      result.recordErrors.push({
        index: idx,
        id,
        reason: `Record #${recordNum} specifies unsupported language "${language}".`,
      });
      result.invalidCount++;
      return;
    }

    // Folder Normalization
    const folder = typeof rawSnippet.folder === 'string' && rawSnippet.folder.trim().length > 0
      ? rawSnippet.folder.trim().slice(0, MAX_FOLDER_LENGTH)
      : 'General';

    // Tags Normalization
    const tags = normalizeTags(rawSnippet.tags);

    // Pin State
    const isPinned = Boolean(rawSnippet.isPinned);

    // Timestamps
    const now = Date.now();
    const createdAt = typeof rawSnippet.createdAt === 'number' && rawSnippet.createdAt > 0 
      ? rawSnippet.createdAt 
      : now;
    const updatedAt = typeof rawSnippet.updatedAt === 'number' && rawSnippet.updatedAt > 0 
      ? rawSnippet.updatedAt 
      : now;

    // Security: Recompute sensitive metadata fresh from actual code
    // Never trust imported flags or potentially manipulated masked output
    const { hasSensitiveData, maskedCode } = computeSensitiveMetadata(code);
    if (hasSensitiveData) {
      result.sensitiveCount++;
    }

    const normalizedSnippet = {
      id,
      title,
      code,
      language,
      tags,
      folder,
      isPinned,
      hasSensitiveData,
      maskedCode,
      createdAt,
      updatedAt,
    };

    result.validSnippets.push(normalizedSnippet);
    result.validCount++;

    if (existingIds.has(id)) {
      result.conflictingSnippets.push(normalizedSnippet);
      result.conflictingCount++;
    } else {
      result.newSnippets.push(normalizedSnippet);
      result.newCount++;
    }
  });

  result.isValid = result.errors.length === 0 && result.validCount > 0;
  return result;
}
