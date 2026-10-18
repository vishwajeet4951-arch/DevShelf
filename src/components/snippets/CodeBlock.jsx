import React, { useMemo, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { tokenizeCode } from '../../utils/highlighter.js';

export default function CodeBlock({
  code = '',
  language = 'javascript',
  maxLines = null,
  showLineNumbers = true,
  showCopyButton = true,
  onCopy,
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  // Tokenize code lines safely with Prism
  const allLines = useMemo(() => {
    return tokenizeCode(code, language);
  }, [code, language]);

  const displayLines = useMemo(() => {
    if (typeof maxLines === 'number' && maxLines > 0) {
      return allLines.slice(0, maxLines);
    }
    return allLines;
  }, [allLines, maxLines]);

  const hasTruncatedLines = Boolean(maxLines && allLines.length > maxLines);
  const remainingLinesCount = allLines.length - (maxLines || 0);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      onCopy?.('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onCopy?.('Failed to copy to clipboard', 'error');
    }
  };

  return (
    <div className={`relative group/code rounded-lg bg-slate-950 dark:bg-black/75 border border-slate-900 overflow-hidden ${className}`}>
      {/* Floating Copy Button */}
      {showCopyButton && (
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all opacity-0 group-hover/code:opacity-100 focus:opacity-100 shadow-md backdrop-blur-xs z-10"
          title="Copy code"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      )}

      {/* Code Area */}
      <div className="overflow-x-auto p-3 font-mono text-xs leading-relaxed select-text">
        <table className="w-full border-collapse">
          <tbody>
            {displayLines.map((line) => (
              <tr key={line.lineNumber} className="hover:bg-slate-900/40">
                {/* Line number gutter */}
                {showLineNumbers && (
                  <td className="w-8 shrink-0 text-slate-600 text-right pr-3 select-none text-[11px] align-top font-mono">
                    {line.lineNumber}
                  </td>
                )}
                {/* Line tokens */}
                <td className="text-slate-200 whitespace-pre align-top font-mono">
                  {line.tokens.length > 0 ? (
                    line.tokens.map((token, idx) => (
                      <span
                        key={idx}
                        className={token.type ? `token ${token.type}` : undefined}
                      >
                        {token.content}
                      </span>
                    ))
                  ) : (
                    <span> </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Truncation indicator for card previews */}
        {hasTruncatedLines && (
          <div className="text-[10px] text-slate-500 font-mono pl-11 pt-1.5 select-none">
            ... +{remainingLinesCount} more lines (click card to view full code)
          </div>
        )}
      </div>
    </div>
  );
}
