import React from 'react';
import { 
  Pin, 
  Edit3, 
  CopyPlus, 
  Trash2, 
  Folder, 
  Tag as TagIcon,
  Clock,
  ShieldAlert
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

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export default function SnippetCard({
  snippet,
  onSelectSnippet,
  onEdit,
  onDelete,
  onDuplicate,
  onTogglePin,
  onSelectTag,
  onCopy,
}) {
  const isSensitive = Boolean(snippet.hasSensitiveData);
  const displayCode = isSensitive
    ? (snippet.maskedCode || maskSensitiveData(snippet.code).maskedCode)
    : snippet.code;

  return (
    <article 
      onClick={() => onSelectSnippet?.(snippet)}
      className={`group relative flex flex-col rounded-xl border bg-white dark:bg-dev-sidebar-dark transition-all duration-200 hover:shadow-lg cursor-pointer ${
        snippet.isPinned 
          ? 'border-amber-400/50 dark:border-amber-500/40 shadow-xs shadow-amber-500/5' 
          : 'border-slate-200 dark:border-dev-sidebar-border hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Top Meta Bar */}
      <div className="p-4 pb-2.5 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            {/* Language pill */}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
              <span className={`w-1.5 h-1.5 rounded-full ${LANGUAGE_COLORS[snippet.language] || 'bg-slate-400'}`} />
              {snippet.language}
            </span>

            {/* Folder pill */}
            {snippet.folder && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60">
                <Folder className="w-3 h-3 text-slate-400" />
                <span className="truncate max-w-[120px]">{snippet.folder}</span>
              </span>
            )}

            {/* Pinned pill */}
            {snippet.isPinned && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <Pin className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                <span>Pinned</span>
              </span>
            )}

            {/* Sensitive pill */}
            {isSensitive && (
              <span 
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40"
                title="Contains detected sensitive credentials (masked by default)"
              >
                <ShieldAlert className="w-2.5 h-2.5 text-rose-500 shrink-0" />
                <span>Sensitive</span>
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" title={snippet.title}>
            {snippet.title}
          </h3>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Pin toggle */}
          <button
            type="button"
            onClick={() => onTogglePin(snippet.id)}
            className={`p-1.5 rounded-md transition-colors ${
              snippet.isPinned
                ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title={snippet.isPinned ? "Unpin snippet" : "Pin to top"}
            aria-label={snippet.isPinned ? "Unpin snippet" : "Pin to top"}
          >
            <Pin className={`w-3.5 h-3.5 ${snippet.isPinned ? 'fill-amber-500' : ''}`} />
          </button>

          {/* Edit button */}
          <button
            type="button"
            onClick={() => onEdit(snippet)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Edit snippet"
            aria-label="Edit snippet"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate button */}
          <button
            type="button"
            onClick={() => onDuplicate(snippet.id)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Duplicate snippet"
            aria-label="Duplicate snippet"
          >
            <CopyPlus className="w-3.5 h-3.5" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={() => onDelete(snippet)}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            title="Delete snippet"
            aria-label="Delete snippet"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Code Preview Box with Syntax Highlighting */}
      <div className="mx-4 my-1.5">
        <CodeBlock
          code={displayCode}
          language={snippet.language}
          maxLines={4}
          showLineNumbers={true}
          showCopyButton={true}
          onCopy={(msg, type) => {
            if (isSensitive) {
              onCopy?.('Copied masked code. Open snippet details to reveal unmasked secrets.', 'info');
            } else {
              onCopy?.(msg, type);
            }
          }}
        />
      </div>

      {/* Card Footer */}
      <div className="p-4 pt-2 mt-auto flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        {/* Tags */}
        <div className="flex items-center gap-1 overflow-hidden mr-2">
          {snippet.tags && snippet.tags.length > 0 ? (
            <div className="flex items-center gap-1 truncate">
              <TagIcon className="w-3 h-3 text-slate-400 shrink-0" />
              {snippet.tags.slice(0, 3).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTag?.(tag);
                  }}
                  className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                >
                  #{tag}
                </button>
              ))}
              {snippet.tags.length > 3 && (
                <span className="text-[10px] text-slate-400 font-mono">
                  +{snippet.tags.length - 3}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 italic">No tags</span>
          )}
        </div>

        {/* Updated timestamp */}
        <div className="flex items-center gap-1 shrink-0 font-mono text-[10px] text-slate-400 dark:text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{formatTimestamp(snippet.updatedAt)}</span>
        </div>
      </div>
    </article>
  );
}
