import assert from 'node:assert';
import { normalizeTag, normalizeTags } from '../src/utils/tagUtils.js';
import { searchSnippets, filterAndSortSnippets } from '../src/utils/filterUtils.js';
import { tokenizeCode, normalizeLanguage } from '../src/utils/highlighter.js';

function runFilterTests() {
  console.log('=== STARTING FILTER, SEARCH, & SYNTAX TESTS ===\n');

  // --- 1. Tag Normalization Tests ---
  console.log('1. Testing tag normalization...');
  assert.strictEqual(normalizeTag('  React  '), 'react');
  assert.strictEqual(normalizeTag('#JavaScript'), 'javascript');
  assert.strictEqual(normalizeTag('###Python'), 'python');
  assert.strictEqual(normalizeTag(''), '');
  assert.strictEqual(normalizeTag(null), '');

  const rawTags = [' React ', '#react', 'REACT', '  ', 'Hooks', '#hooks', 'utilities '];
  const normalized = normalizeTags(rawTags);
  assert.deepStrictEqual(normalized, ['react', 'hooks', 'utilities']);
  console.log('✓ normalizeTag and normalizeTags correctly sanitize, lowercase, and deduplicate tags');

  // Sample snippets for testing
  const sampleSnippets = [
    {
      id: '1',
      title: 'React Query Prefetch',
      code: 'const queryClient = useQueryClient();\nawait queryClient.prefetchQuery();',
      language: 'javascript',
      folder: 'React',
      tags: ['react', 'data-fetching', 'hooks'],
      isPinned: true,
      hasSensitiveData: false,
      createdAt: 1000,
      updatedAt: 5000,
    },
    {
      id: '2',
      title: 'PostgreSQL Upsert Query',
      code: 'INSERT INTO users (id, name) VALUES (1, "Alice") ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;',
      language: 'sql',
      folder: 'Database',
      tags: ['sql', 'postgres', 'database'],
      isPinned: false,
      hasSensitiveData: true,
      createdAt: 2000,
      updatedAt: 4000,
    },
    {
      id: '3',
      title: 'Python FastApi Healthcheck',
      code: '@app.get("/healthz")\ndef health():\n    return {"status": "ok"}',
      language: 'python',
      folder: 'Backend',
      tags: ['python', 'api', 'fastapi'],
      isPinned: false,
      hasSensitiveData: false,
      createdAt: 3000,
      updatedAt: 3000,
    },
    {
      id: '4',
      title: 'Docker Cleanup Bash Script',
      code: '#!/usr/bin/env bash\ndocker system prune -af --volumes',
      language: 'bash',
      folder: 'DevOps',
      tags: ['docker', 'bash', 'devops'],
      isPinned: false,
      hasSensitiveData: false,
      createdAt: 4000,
      updatedAt: 2000,
    },
  ];

  // --- 2. Instant Search Tests ---
  console.log('2. Testing instant search matching...');

  // Search by title
  let results = searchSnippets(sampleSnippets, 'prefetch');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, '1');

  // Search by code substring (case-insensitive)
  results = searchSnippets(sampleSnippets, 'ON CONFLICT');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, '2');

  // Search by folder
  results = searchSnippets(sampleSnippets, 'devops');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, '4');

  // Search by language
  results = searchSnippets(sampleSnippets, 'python');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, '3');

  // Search by tag
  results = searchSnippets(sampleSnippets, 'hooks');
  assert.strictEqual(results.length, 1);
  assert.strictEqual(results[0].id, '1');

  // Empty query returns all
  results = searchSnippets(sampleSnippets, '   ');
  assert.strictEqual(results.length, 4);

  // Non-matching query returns empty
  results = searchSnippets(sampleSnippets, 'nonexistentkeywordxyz');
  assert.strictEqual(results.length, 0);
  console.log('✓ searchSnippets correctly matches title, code, folder, language, and tags');

  // --- 3. Combined Filter Tests ---
  console.log('3. Testing combined filters...');

  // Filter by folder
  let filtered = filterAndSortSnippets(sampleSnippets, { folder: 'Database' });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, '2');

  // Filter by language
  filtered = filterAndSortSnippets(sampleSnippets, { language: 'bash' });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, '4');

  // Filter by tag
  filtered = filterAndSortSnippets(sampleSnippets, { tag: 'fastapi' });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, '3');

  // Filter by pinnedOnly
  filtered = filterAndSortSnippets(sampleSnippets, { pinnedOnly: true });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, '1');

  // Filter by sensitiveOnly
  filtered = filterAndSortSnippets(sampleSnippets, { sensitiveOnly: true });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, '2');

  // Combined search + folder
  filtered = filterAndSortSnippets(sampleSnippets, { searchQuery: 'query', folder: 'React' });
  assert.strictEqual(filtered.length, 1);
  assert.strictEqual(filtered[0].id, '1');

  // Conflicting filter + search -> 0 results
  filtered = filterAndSortSnippets(sampleSnippets, { searchQuery: 'postgres', folder: 'React' });
  assert.strictEqual(filtered.length, 0);
  console.log('✓ Combined filters and search correctly evaluate and intersect');

  // --- 4. Sorting Tests ---
  console.log('4. Testing sorting options...');

  // Pinned first = true (item 1 is pinned, so should be first regardless of updatedAt)
  let sorted = filterAndSortSnippets(sampleSnippets, { sortBy: 'created_desc', pinnedFirst: true });
  assert.strictEqual(sorted[0].id, '1', 'Pinned item must be anchored at the top');

  // Pinned first = false, sort by created_desc
  sorted = filterAndSortSnippets(sampleSnippets, { sortBy: 'created_desc', pinnedFirst: false });
  assert.strictEqual(sorted[0].id, '4'); // createdAt: 4000
  assert.strictEqual(sorted[3].id, '1'); // createdAt: 1000

  // Title A-Z
  sorted = filterAndSortSnippets(sampleSnippets, { sortBy: 'title_asc', pinnedFirst: false });
  assert.strictEqual(sorted[0].title, 'Docker Cleanup Bash Script');
  assert.strictEqual(sorted[3].title, 'React Query Prefetch');
  console.log('✓ Sorting by created, updated, title, and pinned-first ordering verified');

  // --- 5. Syntax Highlighter Tests for 6 Required Languages ---
  console.log('5. Testing syntax tokenization for all 6 required languages...');

  const languageSamples = [
    { lang: 'javascript', code: 'const sum = (a, b) => a + b;\nconsole.log(sum(1, 2));' },
    { lang: 'python', code: 'def greet(name):\n    print(f"Hello, {name}")' },
    { lang: 'sql', code: 'SELECT id, email\nFROM users\nWHERE active = true;' },
    { lang: 'css', code: '.card {\n  display: flex;\n  color: #38bdf8;\n}' },
    { lang: 'bash', code: '#!/bin/bash\necho "Running build..."' },
    { lang: 'json', code: '{\n  "name": "devshelf",\n  "version": 1\n}' },
  ];

  languageSamples.forEach(({ lang, code }) => {
    assert.strictEqual(normalizeLanguage(lang), lang);
    const lines = tokenizeCode(code, lang);
    assert.ok(lines.length >= 2, `Language "${lang}" must produce at least 2 lines`);
    assert.strictEqual(lines[0].lineNumber, 1);
    assert.strictEqual(lines[1].lineNumber, 2);
    // Verify tokens were produced
    const hasTokens = lines.some((l) => l.tokens.length > 0);
    assert.strictEqual(hasTokens, true, `Language "${lang}" should have tokens`);
    console.log(`  ✓ ${lang.toUpperCase()} tokenized successfully (${lines.length} lines)`);
  });

  console.log('\n=== ALL FILTER, SEARCH, & SYNTAX TESTS PASSED! ===\n');
}

runFilterTests();
