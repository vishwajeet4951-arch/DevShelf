import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ShieldAlert, 
  RefreshCw, 
  ArrowRight,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { validateBackup } from '../../utils/backupValidator.js';

/**
 * Format bytes into human-readable string
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ImportModal({
  isOpen,
  onClose,
  existingSnippets = [],
  onImport,
}) {
  const [file, setFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState('merge'); // 'merge' | 'replace'
  const [conflictPolicy, setConflictPolicy] = useState('skip'); // 'skip' | 'overwrite' | 'keep_both'
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showInvalidDetails, setShowInvalidDetails] = useState(false);
  const [importError, setImportError] = useState(null);

  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // Global Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isImporting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isImporting, onClose]);

  // Handle file reading and validation
  const processFile = useCallback((selectedFile) => {
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.json') && selectedFile.type !== 'application/json') {
      setImportError('Please select a valid .json backup file.');
      return;
    }

    setFile(selectedFile);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      try {
        const validated = validateBackup(text, existingSnippets);
        setValidationResult(validated);
      } catch (err) {
        setImportError(err.message || 'Validation failed.');
      }
    };
    reader.onerror = () => {
      setImportError('Failed to read the selected file.');
    };
    reader.readAsText(selectedFile);
  }, [existingSnippets]);

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setValidationResult(null);
    setConfirmReplace(false);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.validCount === 0 || isImporting) return;

    if (mode === 'replace' && !confirmReplace) {
      setImportError('Please confirm that you understand this will replace all current snippets.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      await onImport(validationResult.validSnippets, {
        mode,
        conflictPolicy,
      });
      onClose();
    } catch (err) {
      setImportError(err.message || 'Import failed. Your existing database remains untouched.');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  const canSubmit = Boolean(
    validationResult &&
    validationResult.validCount > 0 &&
    !isImporting &&
    (mode !== 'replace' || confirmReplace)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={() => {
          if (!isImporting) onClose();
        }}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div 
        className="relative w-full max-w-xl bg-white dark:bg-dev-sidebar-dark rounded-xl border border-slate-200 dark:border-dev-sidebar-border shadow-2xl overflow-hidden z-10 flex flex-col my-auto max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-dialog-title"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-dev-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 id="import-dialog-title" className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                Import JSON Backup
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Restore or merge code snippets from a DevShelf backup file
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* File Picker / Dropzone */}
          {!file ? (
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                  : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 bg-slate-50/50 dark:bg-slate-900/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200">
                Click to browse or drop your <span className="font-mono text-indigo-600 dark:text-indigo-400">.json</span> backup file here
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Only valid DevShelf version 1.0 backup files are supported (max 10 MB)
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {file.name}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {formatFileSize(file.size)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearFile}
                disabled={isImporting}
                className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded transition-colors"
              >
                Change
              </button>
            </div>
          )}

          {/* Validation Feedback & Warnings */}
          {validationResult && (
            <div className="space-y-3">
              {validationResult.errors.length > 0 ? (
                <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 space-y-1.5">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>Invalid Backup File Structure</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  {/* Summary Metric Badges */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-dev-sidebar-dark">
                      <div className="text-[11px] text-slate-400">Total in File</div>
                      <div className="text-base font-semibold text-slate-900 dark:text-white mt-0.5">
                        {validationResult.totalInFile}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <div className="text-[11px] text-emerald-600 dark:text-emerald-400">Valid Snippets</div>
                      <div className="text-base font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                        {validationResult.validCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20">
                      <div className="text-[11px] text-amber-600 dark:text-amber-400">Conflicts</div>
                      <div className="text-base font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
                        {validationResult.conflictingCount}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-dev-sidebar-dark">
                      <div className="text-[11px] text-slate-400">New Snippets</div>
                      <div className="text-base font-semibold text-indigo-600 dark:text-indigo-400 mt-0.5">
                        {validationResult.newCount}
                      </div>
                    </div>
                  </div>

                  {/* Sensitive Data Notice */}
                  {validationResult.sensitiveCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                      <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{validationResult.sensitiveCount} {validationResult.sensitiveCount === 1 ? 'snippet contains' : 'snippets contain'} sensitive credentials.</span>
                        <p className="text-[11px] text-amber-600/90 dark:text-amber-400/90 mt-0.5">
                          DevShelf will automatically protect these credentials with visual masking upon import.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Partial Invalid Records Warning */}
                  {validationResult.invalidCount > 0 && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-xs">
                      <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                        <div className="flex items-center gap-1.5 font-semibold">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                          <span>{validationResult.invalidCount} invalid record(s) skipped</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowInvalidDetails(!showInvalidDetails)}
                          className="flex items-center gap-1 text-[11px] underline hover:no-underline"
                        >
                          <span>{showInvalidDetails ? 'Hide details' : 'View details'}</span>
                          {showInvalidDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                      {showInvalidDetails && (
                        <div className="mt-2 max-h-32 overflow-y-auto text-[11px] text-rose-600 dark:text-rose-400 space-y-1 font-mono pl-2 border-l border-rose-200 dark:border-rose-900/50">
                          {validationResult.recordErrors.map((re, idx) => (
                            <div key={idx}>• {re.reason}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mode & Policy Selection */}
                  <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-dev-sidebar-border">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Import Strategy
                    </label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setMode('merge')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          mode === 'merge'
                            ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <CheckCircle2 className={`w-3.5 h-3.5 ${mode === 'merge' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                          <span>Merge Collection</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                          Safely combine backup snippets with your current database.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMode('replace')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          mode === 'replace'
                            ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/30 ring-1 ring-rose-500'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 ${mode === 'replace' ? 'text-rose-600' : 'text-slate-400'}`} />
                          <span>Atomic Replace</span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                          Replace all current snippets with this backup file.
                        </p>
                      </button>
                    </div>

                    {/* Conflict Policy options for Merge mode */}
                    {mode === 'merge' && validationResult.conflictingCount > 0 && (
                      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in duration-150">
                        <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                          {validationResult.conflictingCount} snippet ID conflicts detected. Choose handling:
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              name="conflictPolicy"
                              value="skip"
                              checked={conflictPolicy === 'skip'}
                              onChange={() => setConflictPolicy('skip')}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                              <strong>Skip duplicates</strong> (Recommended) – Keep your existing snippet
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              name="conflictPolicy"
                              value="overwrite"
                              checked={conflictPolicy === 'overwrite'}
                              onChange={() => setConflictPolicy('overwrite')}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                              <strong>Overwrite duplicates</strong> – Update your snippet with imported version
                            </span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                            <input
                              type="radio"
                              name="conflictPolicy"
                              value="keep_both"
                              checked={conflictPolicy === 'keep_both'}
                              onChange={() => setConflictPolicy('keep_both')}
                              className="text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>
                              <strong>Keep both</strong> – Generate a new ID and append "(Imported)" to title
                            </span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Replace Mode Warning & Checkbox */}
                    {mode === 'replace' && (
                      <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-2 animate-in fade-in duration-150">
                        <div className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                          <span>Destructive Action: All current snippets will be replaced!</span>
                        </div>
                        <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90 leading-relaxed">
                          Your current collection ({existingSnippets.length} snippets) will be cleared in an atomic transaction and replaced by the {validationResult.validCount} valid snippets in this backup.
                        </p>
                        <label className="flex items-start gap-2 pt-1 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmReplace}
                            onChange={(e) => setConfirmReplace(e.target.checked)}
                            className="mt-0.5 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                          />
                          <span className="text-xs font-medium text-rose-800 dark:text-rose-200">
                            I understand this will permanently replace all current snippets in IndexedDB
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Import Execution Error */}
          {importError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{importError}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-900/40 border-t border-slate-100 dark:border-dev-sidebar-border flex items-center justify-between">
          <div className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>IndexedDB transactions roll back completely on failure</span>
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={!canSubmit}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white shadow-sm transition-all focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'replace'
                  ? 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              }`}
            >
              {isImporting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Restoring...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'replace' ? 'Replace All Snippets' : 'Import Snippets'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
