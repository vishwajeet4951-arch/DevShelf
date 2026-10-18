import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Code2, Tag as TagIcon, Folder, Pin, Sparkles, ShieldAlert } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '../../services/db';
import { normalizeTag, normalizeTags } from '../../utils/tagUtils';
import { detectSensitiveData } from '../../utils/masker';

function SnippetForm({ initialData, onClose, onSave }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [language, setLanguage] = useState(initialData?.language || 'javascript');
  const [folder, setFolder] = useState(initialData?.folder || 'General');
  const [tags, setTags] = useState(Array.isArray(initialData?.tags) ? [...initialData.tags] : []);
  const [tagInput, setTagInput] = useState('');
  const [isPinned, setIsPinned] = useState(Boolean(initialData?.isPinned));
  const [validationError, setValidationError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasSensitiveData } = useMemo(() => detectSensitiveData(code), [code]);

  const titleInputRef = useRef(null);
  const codeAreaRef = useRef(null);

  const isEdit = Boolean(initialData && initialData.id);

  // Focus title input on mount
  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // Submit handler wrapped in useCallback
  const handleSubmit = useCallback(async (e) => {
    if (e) e.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedCode = code.trim();

    if (!trimmedTitle) {
      setValidationError('Snippet title is required.');
      titleInputRef.current?.focus();
      return;
    }

    if (!trimmedCode) {
      setValidationError('Snippet code is required.');
      codeAreaRef.current?.focus();
      return;
    }

    setValidationError('');
    setIsSubmitting(true);

    try {
      const payload = {
        title: trimmedTitle,
        code,
        language,
        folder: folder.trim() || 'General',
        tags: normalizeTags(tags),
        isPinned,
      };

      if (isEdit) {
        payload.id = initialData.id;
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      setValidationError(err.message || 'Failed to save snippet.');
    } finally {
      setIsSubmitting(false);
    }
  }, [title, code, language, folder, tags, isPinned, isEdit, initialData, onSave, onClose]);

  // Handle Escape key and Ctrl+Enter keyboard submission
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSubmit, onClose]);

  // Handle Tab key in code textarea to insert 2 spaces
  const handleCodeKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);

      // Move cursor after inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  // Add tag pill
  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const normalized = normalizeTag(tagInput);
      if (normalized && !tags.includes(normalized)) {
        setTags([...tags, normalized]);
      }
      setTagInput('');
    }
  };

  // Remove tag pill
  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  return (
    <div 
      className="relative w-full max-w-2xl bg-white dark:bg-dev-sidebar-dark rounded-xl border border-slate-200 dark:border-dev-sidebar-border shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-dev-sidebar-border flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-200/50 dark:border-indigo-800/40">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <h2 id="modal-title" className="text-sm font-semibold text-slate-900 dark:text-white">
              {isEdit ? 'Edit Snippet' : 'New Snippet'}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isEdit ? 'Update snippet contents in IndexedDB' : 'Save code securely in your local IndexedDB shelf'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
            {validationError}
          </div>
        )}

        {/* Title Input */}
        <div>
          <label htmlFor="snippet-title" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Title <span className="text-rose-500">*</span>
          </label>
          <input
            ref={titleInputRef}
            id="snippet-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. useDebounce hook, Docker Compose prod, PostgreSQL upsert..."
            className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            required
          />
        </div>

        {/* Language & Folder row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Language dropdown */}
          <div>
            <label htmlFor="snippet-language" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Language
            </label>
            <select
              id="snippet-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors capitalize font-mono"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Folder input */}
          <div>
            <label htmlFor="snippet-folder" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              <span className="flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-slate-400" />
                <span>Folder</span>
              </span>
            </label>
            <input
              id="snippet-folder"
              type="text"
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="e.g. General, React, Database, DevOps"
              className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>
        </div>

        {/* Tags input */}
        <div>
          <label htmlFor="snippet-tags" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            <span className="flex items-center gap-1">
              <TagIcon className="w-3.5 h-3.5 text-slate-400" />
              <span>Tags</span>
              <span className="text-[10px] text-slate-400 font-normal">(press Enter or comma to add)</span>
            </span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-indigo-500 min-h-[38px]">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-rose-500 focus:outline-none"
                  aria-label={`Remove tag ${tag}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              id="snippet-tags"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              placeholder={tags.length === 0 ? "Type tag name and hit Enter..." : ""}
              className="flex-1 min-w-[120px] bg-transparent text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Code Textarea */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <label htmlFor="snippet-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Code <span className="text-rose-500">*</span>
              </label>
              {hasSensitiveData && (
                <span 
                  className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                  title="Sensitive credentials detected (will be masked in previews)"
                >
                  <ShieldAlert className="w-2.5 h-2.5 text-rose-500" />
                  <span>Sensitive Credentials Detected</span>
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              Tab key inserts 2 spaces
            </span>
          </div>
          <textarea
            ref={codeAreaRef}
            id="snippet-code"
            rows={9}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleCodeKeyDown}
            placeholder="// Paste or write your snippet code here..."
            className="w-full px-3 py-2.5 rounded-lg text-xs font-mono bg-slate-950 text-slate-100 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y selection:bg-indigo-500/30"
            required
            spellCheck="false"
          />
        </div>

        {/* Pin toggle */}
        <div className="flex items-center gap-2 pt-1">
          <input
            id="snippet-is-pinned"
            type="checkbox"
            checked={isPinned}
            onChange={(e) => setIsPinned(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <label htmlFor="snippet-is-pinned" className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <Pin className="w-3.5 h-3.5 text-amber-500" />
            <span>Pin this snippet to top of workspace</span>
          </label>
        </div>
      </form>

      {/* Footer */}
      <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-dev-sidebar-border flex items-center justify-between">
        <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono text-slate-400">
          <span>Press</span>
          <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Ctrl</kbd>
          <span>+</span>
          <kbd className="px-1 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700">Enter</kbd>
          <span>to save</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Saving...' : isEdit ? 'Update Snippet' : 'Save Snippet'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SnippetModal({ isOpen, onClose, onSave, initialData }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Keyed Form to reset state cleanly on open/initialData changes */}
      <SnippetForm
        key={initialData?.id || 'new-snippet'}
        initialData={initialData}
        onClose={onClose}
        onSave={onSave}
      />
    </div>
  );
}
