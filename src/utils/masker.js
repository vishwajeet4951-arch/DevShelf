/**
 * DevShelf Sensitive Data Detector & Masker
 * 
 * Heuristic detection and visual masking engine for common credentials, API keys,
 * passwords, tokens, connection strings, and private keys.
 * 
 * IMPORTANT SECURITY NOTE:
 * Regex-based detection is a client-side heuristic safety feature designed to prevent
 * accidental visual exposure (e.g. during screen sharing, live demos, or shoulder surfing).
 * It CANNOT guarantee detection of every credential format, high-entropy string, or obfuscated secret.
 * It does NOT encrypt snippet contents in IndexedDB.
 */

/**
 * Common placeholder values that should not be flagged as sensitive credentials.
 */
const PLACEHOLDER_PATTERNS = [
  /^(?:your[_-]?)?(?:api[_-]?key|token|secret|password|passwd|pwd)(?:[_-]?here)?$/i,
  /^<[^>]+>$/,                         // e.g. <YOUR_API_KEY>, <PASSWORD>
  /^\[[^\]]+\]$/,                      // e.g. [API_KEY]
  /^(?:todo|placeholder|changeme|example|dummy|sample|replace_me|test|xxxx*|\*\*\*\*)$/i,
  /^(?:true|false|null|undefined|none|nil)$/i,
  /^\$\{.*\}$/,                        // environment variable interpolation e.g. ${API_KEY}
  /^process\.env\./i,                  // e.g. process.env.SECRET
  /^os\.environ/i,
  /^env\(/i,
];

/**
 * Checks whether a matched string is a common placeholder or harmless token.
 * @param {string} val
 * @returns {boolean}
 */
export function isPlaceholder(val) {
  if (!val || typeof val !== 'string') return true;
  const trimmed = val.trim();
  if (trimmed.length < 4) return true; // Most genuine secrets are at least 4 characters
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * @typedef {Object} SecretMatch
 * @property {number} start - Start character index in the original code
 * @property {number} end - End character index in the original code
 * @property {string} type - Identifier for the credential category
 * @property {string} mask - Masked replacement text for the range [start, end]
 */

/**
 * Detects sensitive data matches in the provided code snippet.
 * 
 * Supported patterns:
 * 1. AWS Access Key IDs (AKIA + 16 alphanumeric characters)
 * 2. Known API key prefixes (OpenAI sk-, GitHub ghp_/gho_, GitLab glpat-, Slack xox-)
 * 3. JWT-shaped tokens (3 base64url segments separated by dots starting with eyJ)
 * 4. Bearer authorization tokens
 * 5. Password, secret, and token assignments in code or JSON configurations
 * 6. Database connection strings with embedded passwords (postgres, mysql, mongodb, redis, etc.)
 * 7. PEM Private-Key blocks
 * 
 * @param {string} code - Raw code snippet to inspect
 * @returns {{ hasSensitiveData: boolean, matches: SecretMatch[], matchCount: number }}
 */
export function detectSensitiveData(code) {
  if (!code || typeof code !== 'string') {
    return { hasSensitiveData: false, matches: [], matchCount: 0 };
  }

  const rawMatches = [];

  // 1. AWS Access Key IDs
  const awsRegex = /\b(AKIA[0-9A-Z]{16})\b/g;
  let match;
  while ((match = awsRegex.exec(code)) !== null) {
    const key = match[1];
    rawMatches.push({
      start: match.index,
      end: match.index + key.length,
      type: 'aws_access_key',
      mask: 'AKIA' + '•'.repeat(12) + key.slice(-4),
    });
  }

  // 2. Known API Key Prefixes
  // OpenAI Keys (sk-..., sk-proj-...)
  const openaiRegex = /\b(sk-(?:proj-|live-|test-)?[a-zA-Z0-9_-]{20,})\b/g;
  while ((match = openaiRegex.exec(code)) !== null) {
    const token = match[1];
    rawMatches.push({
      start: match.index,
      end: match.index + token.length,
      type: 'api_key_openai',
      mask: 'sk-' + '•'.repeat(16),
    });
  }

  // GitHub Personal Access Tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  const githubRegex = /\b((?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,})\b/g;
  while ((match = githubRegex.exec(code)) !== null) {
    const prefix = match[1].slice(0, 4);
    rawMatches.push({
      start: match.index,
      end: match.index + match[1].length,
      type: 'api_key_github',
      mask: prefix + '•'.repeat(20),
    });
  }

  // GitLab Personal Access Tokens (glpat-...)
  const gitlabRegex = /\b(glpat-[a-zA-Z0-9_-]{20,})\b/g;
  while ((match = gitlabRegex.exec(code)) !== null) {
    rawMatches.push({
      start: match.index,
      end: match.index + match[1].length,
      type: 'api_key_gitlab',
      mask: 'glpat-' + '•'.repeat(16),
    });
  }

  // Slack Tokens (xoxb-, xoxp-, xoxa-, xoxr-, xoxs-)
  const slackRegex = /\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/g;
  while ((match = slackRegex.exec(code)) !== null) {
    const prefix = match[1].slice(0, 5);
    rawMatches.push({
      start: match.index,
      end: match.index + match[1].length,
      type: 'api_key_slack',
      mask: prefix + '•'.repeat(12),
    });
  }

  // Generic API key / token assignments in code (e.g. api_key = "...", token: "...")
  const genericKeyRegex = /\b((?:api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key|client[_-]?secret)\s*[:=]\s*["'])([^"'\r\n]+)(["'])/gi;
  while ((match = genericKeyRegex.exec(code)) !== null) {
    const val = match[2];
    if (!isPlaceholder(val) && val.length >= 8) {
      const start = match.index + match[1].length;
      rawMatches.push({
        start,
        end: start + val.length,
        type: 'api_key_generic',
        mask: '•'.repeat(Math.min(val.length, 16)),
      });
    }
  }

  // 3. JWT-Shaped Tokens (3 base64url parts separated by dots, starting with eyJ)
  const jwtRegex = /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g;
  while ((match = jwtRegex.exec(code)) !== null) {
    rawMatches.push({
      start: match.index,
      end: match.index + match[1].length,
      type: 'jwt_token',
      mask: 'eyJ••••••••.••••••••.••••••••',
    });
  }

  // 4. Bearer Authorization Tokens
  const bearerRegex = /\b(Bearer\s+)([a-zA-Z0-9_.-]{16,})\b/gi;
  while ((match = bearerRegex.exec(code)) !== null) {
    const token = match[2];
    if (!isPlaceholder(token)) {
      const start = match.index + match[1].length;
      rawMatches.push({
        start,
        end: start + token.length,
        type: 'bearer_token',
        mask: '•'.repeat(16),
      });
    }
  }

  // 5. Password and Secret Assignments (e.g. password = "...", "client_secret": "...")
  const passwordAssignRegex = /\b((?:password|passwd|pwd|db_password|database_password|secret_key|api_secret|client_secret)\s*[:=]\s*["'])([^"'\r\n]+)(["'])/gi;
  while ((match = passwordAssignRegex.exec(code)) !== null) {
    const pwd = match[2];
    if (!isPlaceholder(pwd)) {
      const start = match.index + match[1].length;
      rawMatches.push({
        start,
        end: start + pwd.length,
        type: 'password_assignment',
        mask: '•'.repeat(Math.min(Math.max(pwd.length, 8), 16)),
      });
    }
  }

  // JSON format passwords/secrets (e.g. "password": "...", "clientSecret": "...")
  const jsonPasswordRegex = /("(?:(?:\w*password\w*)|(?:\w*secret\w*))"\s*:\s*")([^"'\r\n]+)(")/gi;
  while ((match = jsonPasswordRegex.exec(code)) !== null) {
    const val = match[2];
    if (!isPlaceholder(val)) {
      const start = match.index + match[1].length;
      rawMatches.push({
        start,
        end: start + val.length,
        type: 'password_json',
        mask: '•'.repeat(Math.min(Math.max(val.length, 8), 16)),
      });
    }
  }

  // 6. Database Connection Strings with Embedded Credentials
  const dbRegex = /\b((?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/([^:\s"'/]+):)([^@\s"']+)(@)/gi;
  while ((match = dbRegex.exec(code)) !== null) {
    const pwd = match[3];
    if (!isPlaceholder(pwd)) {
      const start = match.index + match[1].length;
      rawMatches.push({
        start,
        end: start + pwd.length,
        type: 'db_connection_password',
        mask: '•'.repeat(8),
      });
    }
  }

  // 7. PEM Private-Key Blocks
  const pemRegex = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g;
  while ((match = pemRegex.exec(code)) !== null) {
    const block = match[0];
    const lines = block.split(/\r?\n/);
    const header = lines[0] || '-----BEGIN PRIVATE KEY-----';
    const footer = lines[lines.length - 1] || '-----END PRIVATE KEY-----';
    rawMatches.push({
      start: match.index,
      end: match.index + block.length,
      type: 'pem_private_key',
      mask: `${header}\n[REDACTED SENSITIVE PRIVATE KEY]\n${footer}`,
    });
  }

  // Resolve Overlaps and Sort by Start Position
  // If multiple patterns match or overlap, prioritize the one starting earlier,
  // or the wider match if start positions are identical.
  rawMatches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  const nonOverlappingMatches = [];
  let lastEnd = -1;
  for (const item of rawMatches) {
    if (item.start >= lastEnd) {
      nonOverlappingMatches.push(item);
      lastEnd = item.end;
    }
  }

  return {
    hasSensitiveData: nonOverlappingMatches.length > 0,
    matches: nonOverlappingMatches,
    matchCount: nonOverlappingMatches.length,
  };
}

/**
 * Masks sensitive credentials in the provided code snippet while strictly preserving
 * all non-sensitive code, whitespace, indentation, and formatting.
 * 
 * Never mutates original code.
 * 
 * @param {string} code - Raw code snippet to mask
 * @returns {{ maskedCode: string, hasSensitiveData: boolean, matchCount: number, matches: SecretMatch[] }}
 */
export function maskSensitiveData(code) {
  if (!code || typeof code !== 'string') {
    return {
      maskedCode: code || '',
      hasSensitiveData: false,
      matchCount: 0,
      matches: [],
    };
  }

  const { hasSensitiveData, matches, matchCount } = detectSensitiveData(code);

  if (!hasSensitiveData || matches.length === 0) {
    return {
      maskedCode: code,
      hasSensitiveData: false,
      matchCount: 0,
      matches: [],
    };
  }

  let maskedCode = '';
  let currentIndex = 0;

  for (const match of matches) {
    maskedCode += code.slice(currentIndex, match.start);
    maskedCode += match.mask;
    currentIndex = match.end;
  }
  maskedCode += code.slice(currentIndex);

  return {
    maskedCode,
    hasSensitiveData: true,
    matchCount,
    matches,
  };
}

/**
 * High-level helper for IndexedDB persistence: returns { hasSensitiveData, maskedCode }
 * @param {string} code
 * @returns {{ hasSensitiveData: boolean, maskedCode: string | null }}
 */
export function computeSensitiveMetadata(code) {
  const result = maskSensitiveData(code);
  return {
    hasSensitiveData: result.hasSensitiveData,
    maskedCode: result.hasSensitiveData ? result.maskedCode : null,
  };
}
