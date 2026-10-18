import React, { useEffect, useState, useMemo } from 'react';
import { 
  X, 
  Pin, 
  Copy, 
  Check, 
  Edit3, 
  CopyPlus, 
  Trash2, 
  Folder, 
  Tag as TagIcon, 
  Calendar,
  ShieldAlert,
  Eye,
  EyeOff
} from 'lucide-react';
import CodeBlock from './CodeBlock';
import { maskSensitiveData } from '../../utils/masker.js';

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

function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SnippetDetailModal({
  isOpen,
  snippet,
  onClose,
  onEdit,
  onDelete,
  onDuplicate,
  onTogglePin,
  onSelectTag,
  onCopy,
}) {
  const [copied, setCopied] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isSensitive = Boolean(snippet?.hasSensitiveData);
  const maskedCode = useMemo(() => {
    if (!snippet || !isSensitive) return snippet?.code || '';
    return snippet.maskedCode || maskSensitiveData(snippet.code).maskedCode;
  }, [snippet, isSensitive]);

  if (!isOpen || !snippet) return null;

  const displayCode = isSensitive && !isRevealed ? maskedCode : snippet.code;
  const lineCount = displayCode.split('\n').length;
  const charCount = displayCode.length;

  const handleCopyDisplayCode = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      if (isSensitive && !isRevealed) {
        onCopy?.('Copied masked code. Reveal secrets to copy unmasked credentials.', 'info');
      } else if (isSensitive && isRevealed) {
        onCopy?.('Copied unmasked code containing credentials.', 'info');
      } else {
        onCopy?.('Snippet code copied to clipboard');
      }
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopy?.('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyRawCode = async () => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      onCopy?.('Copied raw code containing credentials. Handle with caution!', 'info');
    } catch {
      onCopy?.('Failed to copy to clipboard', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div 
        className="relative w-full max-w-4xl bg-white dark:bg-dev-sidebar-dark rounded-xl border border-slate-200 dark:border-dev-sidebar-border shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-dev-sidebar-border flex items-start justify-between gap-4 bg-slate-50/70 dark:bg-slate-900/40">
          <div className="flex-1 min-w-0">
            {/* Meta badges */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Language pill */}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono font-medium uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                <span className={`w-2 h-2 rounded-full ${LANGUAGE_COLORS[snippet.language] || 'bg-slate-400'}`} />
                {snippet.language}
              </span>

              {/* Folder pill */}
              {snippet.folder && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
                  <Folder className="w-3.5 h-3.5 text-slate-400" />
                  <span>{snippet.folder}</span>
                </span>
              )}

              {/* Pinned pill */}
              {snippet.isPinned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                  <Pin className="w-3 h-3 fill-amber-500 text-amber-500" />
                  <span>Pinned</span>
                </span>
              )}

              {/* Sensitive pill */}
              {isSensitive && (
                <span 
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                  title="Contains sensitive credentials"
                >
                  <ShieldAlert className="w-3 h-3 text-rose-500" />
                  <span>Contains Sensitive Data</span>
                </span>
              )}

              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 ml-auto">
                {lineCount} lines • {charCount} chars
              </span>
            </div>

            {/* Title */}
            <h2 id="detail-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {snippet.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Sensitive Data Warning & Reveal Control Banner */}
          {isSensitive && (
            <div className="p-3.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-semibold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                    <span>Sensitive Credentials Detected</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300">
                      {isRevealed ? 'UNMASKED' : 'MASKED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5 leading-normal">
                    {isRevealed
                      ? 'Credentials are now visible. Ensure your screen is private before sharing or streaming.'
                      : 'Sensitive API keys, tokens, or passwords are visually masked by default for safety.'}
                  </p>
                </div>
              </div>

              {/* Explicit Reveal / Hide Toggle Button */}
              <button
                type="button"
                onClick={() => setIsRevealed(!isRevealed)}
                aria-pressed={isRevealed}
                aria-label={isRevealed ? "Hide sensitive credentials" : "Reveal sensitive credentials"}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                  isRevealed
                    ? 'bg-rose-100 dark:bg-rose-900/60 hover:bg-rose-200 dark:hover:bg-rose-800 text-rose-900 dark:text-rose-100 border border-rose-300 dark:border-rose-800'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shadow-2xs'
                }`}
              >
                {isRevealed ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-rose-500" />
                    <span>Hide Secrets</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                    <span>Reveal Secrets</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Syntax Highlighted Code Viewer */}
          <CodeBlock
            code={displayCode}
            language={snippet.language}
            showLineNumbers={true}
            showCopyButton={true}
            onCopy={(msg, type) => {
              if (isSensitive && !isRevealed) {
                onCopy?.('Copied masked code. Reveal secrets or click "Copy Raw" for unmasked credentials.', 'info');
              } else if (isSensitive && isRevealed) {
                onCopy?.('Copied unmasked code containing credentials.', 'info');
              } else {
                onCopy?.(msg, type);
              }
            }}
            className="max-h-[55vh]"
          />

          {/* Tags list */}
          {snippet.tags && snippet.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <TagIcon className="w-3.5 h-3.5 text-slate-400" />
                <span>Tags:</span>
              </span>
              {snippet.tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    onSelectTag?.(tag);
                    onClose();
                  }}
                  className="px-2 py-0.5 rounded font-mono text-xs bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors"
                  title={`Filter by #${tag}`}
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {/* Timestamps footer */}
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-dev-sidebar-border">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created: {formatDate(snippet.createdAt)}</span>
            </span>
            <span>•</span>
            <span>Last updated: {formatDate(snippet.updatedAt)}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-200 dark:border-dev-sidebar-border flex items-center justify-between gap-2 flex-wrap">
          {/* Left actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onTogglePin(snippet.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                snippet.isPinned
                  ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800'
                  : 'text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Pin className={`w-3.5 h-3.5 ${snippet.isPinned ? 'fill-amber-500' : ''}`} />
              <span>{snippet.isPinned ? 'Unpin' : 'Pin to Top'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDuplicate(snippet.id);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <CopyPlus className="w-3.5 h-3.5" />
              <span>Duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onDelete(snippet);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Copy button(s) */}
            {isSensitive && !isRevealed ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyDisplayCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                  title="Copy masked code (safe for sharing)"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Masked'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyRawCode}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  title="Copy unmasked original code with secrets"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Raw</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleCopyDisplayCode}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  isSensitive && isRevealed
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : 'bg-slate-200/80 dark:bg-slate-800 text-slate-900 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-700'
                }`}
                title={isSensitive && isRevealed ? "Copy unmasked code with credentials" : "Copy code"}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : (isSensitive && isRevealed ? 'Copy Code (Unmasked)' : 'Copy Code')}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onEdit(snippet);
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Snippet</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
