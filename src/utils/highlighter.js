import Prism from 'prismjs';

// Load language grammars for the six required languages
import 'prismjs/components/prism-python.js';
import 'prismjs/components/prism-sql.js';
import 'prismjs/components/prism-css.js';
import 'prismjs/components/prism-bash.js';
import 'prismjs/components/prism-json.js';

/**
 * Normalizes language string to a supported Prism grammar key.
 * @param {string} lang
 * @returns {string}
 */
export function normalizeLanguage(lang) {
  if (!lang) return 'javascript';
  const l = lang.toLowerCase().trim();
  switch (l) {
    case 'js':
    case 'jsx':
    case 'javascript':
      return 'javascript';
    case 'py':
    case 'python':
      return 'python';
    case 'sql':
    case 'mysql':
    case 'pgsql':
    case 'postgres':
      return 'sql';
    case 'css':
      return 'css';
    case 'bash':
    case 'sh':
    case 'shell':
    case 'zsh':
      return 'bash';
    case 'json':
      return 'json';
    default:
      return Prism.languages[l] ? l : 'javascript';
  }
}

/**
 * Flattens Prism tokens into line-by-line structured token objects.
 * Handles multiline comments, strings, and whitespace while keeping text 100% safe.
 * 
 * @param {string} code
 * @param {string} language
 * @returns {Array<{ lineNumber: number, tokens: Array<{ content: string, type: string|null }> }>}
 */
export function tokenizeCode(code, language) {
  if (typeof code !== 'string') return [];

  const langKey = normalizeLanguage(language);
  const grammar = Prism.languages[langKey] || Prism.languages.javascript;
  const rawTokens = Prism.tokenize(code, grammar);

  const lines = [{ lineNumber: 1, tokens: [] }];
  let currentLineIndex = 0;

  function processToken(token, parentType = null) {
    if (typeof token === 'string') {
      const parts = token.split('\n');
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
          currentLineIndex++;
          lines.push({ lineNumber: currentLineIndex + 1, tokens: [] });
        }
        if (parts[i].length > 0) {
          lines[currentLineIndex].tokens.push({
            content: parts[i],
            type: parentType,
          });
        }
      }
    } else if (token && typeof token === 'object') {
      const tokenType = parentType ? `${parentType} ${token.type}` : token.type;
      if (Array.isArray(token.content)) {
        token.content.forEach((nested) => processToken(nested, tokenType));
      } else {
        processToken(token.content, tokenType);
      }
    }
  }

  rawTokens.forEach((t) => processToken(t));

  return lines;
}
