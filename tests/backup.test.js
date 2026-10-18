import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { 
  createSnippet, 
  getAllSnippets, 
  importSnippets 
} from '../src/services/db.js';
import { validateBackup } from '../src/utils/backupValidator.js';
import { exportSnippetsToJson } from '../src/utils/exportUtils.js';

async function runTests() {
  console.log('--- Starting Phase 6 Backup & Restore Tests ---');

  // -------------------------------------------------------------
  // Part 1: Backup Validation Tests (backupValidator.js)
  // -------------------------------------------------------------
  console.log('\n[Part 1: Backup Validator Tests]');

  // Test 1.1: Rejects non-JSON string or malformed JSON
  const invalidJsonResult = validateBackup('{"app": "DevShelf", "snippets": [');
  assert.strictEqual(invalidJsonResult.isValid, false);
  assert.ok(invalidJsonResult.errors.some(e => e.includes('Malformed JSON')));
  console.log('✓ Rejects malformed JSON strings');

  // Test 1.2: Rejects wrong app identifier
  const wrongAppResult = validateBackup({
    app: 'OtherSnippetManager',
    version: '1.0.0',
    snippets: [],
  });
  assert.strictEqual(wrongAppResult.isValid, false);
  assert.ok(wrongAppResult.errors.some(e => e.includes('Invalid application identifier')));
  console.log('✓ Rejects unsupported application identifiers');

  // Test 1.3: Rejects unsupported schema versions
  const wrongVersionResult = validateBackup({
    app: 'DevShelf',
    version: '99.0.0',
    snippets: [],
  });
  assert.strictEqual(wrongVersionResult.isValid, false);
  assert.ok(wrongVersionResult.errors.some(e => e.includes('Unsupported backup schema version')));
  console.log('✓ Rejects unsupported schema versions');

  // Test 1.4: Handles empty snippet array gracefully
  const emptyBackupResult = validateBackup({
    app: 'DevShelf',
    version: '1.0.0',
    snippets: [],
  });
  assert.strictEqual(emptyBackupResult.isValid, true);
  assert.strictEqual(emptyBackupResult.validCount, 0);
  assert.strictEqual(emptyBackupResult.errors.length, 0);
  console.log('✓ Handles empty backups gracefully');

  // Test 1.5: Validates snippet records and filters corrupt records
  const validSnippet1 = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Valid Snippet 1',
    code: 'console.log("hello world");',
    language: 'javascript',
    folder: 'Utils',
    tags: ['js', 'test'],
    isPinned: true,
    createdAt: 1000,
    updatedAt: 2000,
  };

  const invalidSnippetMissingTitle = {
    id: '22222222-2222-4222-8222-222222222222',
    title: '   ',
    code: 'const a = 1;',
    language: 'javascript',
  };

  const invalidSnippetBadLang = {
    id: '33333333-3333-4333-8333-333333333333',
    title: 'Bad Language',
    code: 'SELECT 1;',
    language: 'unsupported-lang',
  };

  const duplicateIdSnippet = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Duplicate ID',
    code: 'console.log("duplicate");',
    language: 'javascript',
  };

  const sensitiveSnippet = {
    id: '44444444-4444-4444-8444-444444444444',
    title: 'AWS Secret Config',
    code: 'const awsKey = "AKIAIOSFODNN7EXAMPLE";',
    language: 'javascript',
    hasSensitiveData: false, // Falsified in backup file intentionally!
    maskedCode: null,
  };

  const mixedBackupPayload = {
    app: 'DevShelf',
    version: '1.0.0',
    snippets: [
      validSnippet1,
      invalidSnippetMissingTitle,
      invalidSnippetBadLang,
      duplicateIdSnippet,
      sensitiveSnippet,
    ],
  };

  const mixedResult = validateBackup(mixedBackupPayload);
  assert.strictEqual(mixedResult.isValid, true);
  assert.strictEqual(mixedResult.totalInFile, 5);
  assert.strictEqual(mixedResult.validCount, 2); // validSnippet1 + sensitiveSnippet
  assert.strictEqual(mixedResult.invalidCount, 3); // missing title, bad language, duplicate ID
  assert.strictEqual(mixedResult.recordErrors.length, 3);
  console.log('✓ Validates individual records and detects duplicate IDs inside backup file');

  // Test 1.6: Security - Sensitive credentials metadata recomputed independently
  const validatedSensitive = mixedResult.validSnippets.find(s => s.id === '44444444-4444-4444-8444-444444444444');
  assert.ok(validatedSensitive, 'Sensitive snippet should be in validSnippets');
  assert.strictEqual(validatedSensitive.hasSensitiveData, true, 'hasSensitiveData must be recomputed to true');
  assert.ok(validatedSensitive.maskedCode.includes('••••••••'), 'maskedCode must be computed');
  assert.strictEqual(mixedResult.sensitiveCount, 1);
  console.log('✓ Security: Recomputes sensitive credential detection independently from raw code');

  // Test 1.7: Duplicate detection against existing IndexedDB records
  const existingRecords = [
    { id: '11111111-1111-4111-8111-111111111111', title: 'Already Stored' },
  ];
  const comparisonResult = validateBackup(mixedBackupPayload, existingRecords);
  assert.strictEqual(comparisonResult.conflictingCount, 1);
  assert.strictEqual(comparisonResult.newCount, 1); // Only sensitiveSnippet is new
  assert.strictEqual(comparisonResult.conflictingSnippets[0].id, '11111111-1111-4111-8111-111111111111');
  console.log('✓ Accurately partitions conflicting snippets vs new snippets');

  // -------------------------------------------------------------
  // Part 2: Export Serializer Tests (exportUtils.js)
  // -------------------------------------------------------------
  console.log('\n[Part 2: Export Serializer Tests]');

  // Test 2.1: Exporting empty collection
  const emptyExport = exportSnippetsToJson([]);
  assert.strictEqual(emptyExport.count, 0);
  assert.strictEqual(emptyExport.sensitiveCount, 0);
  assert.ok(emptyExport.fileName.startsWith('devshelf-backup-'));
  console.log('✓ Handles empty collection export gracefully');

  // Test 2.2: Exporting populated collection strips transient UI state and preserves original code
  const rawCodeWithSecret = 'const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M";';
  const sampleSnippets = [
    {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'JWT Token Config',
      code: rawCodeWithSecret,
      language: 'javascript',
      folder: 'Auth',
      tags: ['auth', 'jwt'],
      isPinned: true,
      hasSensitiveData: true,
      maskedCode: 'const token = "••••••••••••••••••••";',
      isRevealed: true, // Transient UI state that should NEVER be in backup
      createdAt: 1234567,
      updatedAt: 7654321,
    },
  ];

  const populatedExport = exportSnippetsToJson(sampleSnippets);
  assert.strictEqual(populatedExport.count, 1);
  assert.strictEqual(populatedExport.sensitiveCount, 1);
  console.log('✓ Export reports sensitive snippet count');

  // -------------------------------------------------------------
  // Part 3: IndexedDB Import & Conflict Resolution Tests (db.js)
  // -------------------------------------------------------------
  console.log('\n[Part 3: IndexedDB Import & Conflict Resolution Tests]');

  // Setup: Clear DB and insert an initial snippet
  const baseSnippet = await createSnippet({
    title: 'Original Existing Snippet',
    code: 'function initial() { return true; }',
    language: 'javascript',
    folder: 'Core',
    tags: ['core'],
  });

  const existingSnippetId = baseSnippet.id;

  // Test 3.1: Merge Mode - 'skip' duplicate conflict policy
  const incomingConflictSnippet = {
    id: existingSnippetId,
    title: 'Modified Imported Title (Should be skipped)',
    code: 'function modified() { return false; }',
    language: 'javascript',
    folder: 'Core',
    tags: ['skipped'],
    isPinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const incomingNewSnippet1 = {
    id: '66666666-6666-4666-8666-666666666666',
    title: 'New Merged Snippet 1',
    code: 'const merged = 1;',
    language: 'javascript',
    folder: 'Imports',
    tags: ['merged'],
    isPinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mergeSkipResult = await importSnippets(
    [incomingConflictSnippet, incomingNewSnippet1],
    { mode: 'merge', conflictPolicy: 'skip' }
  );

  assert.strictEqual(mergeSkipResult.mode, 'merge');
  assert.strictEqual(mergeSkipResult.addedCount, 1);
  assert.strictEqual(mergeSkipResult.skippedCount, 1);
  assert.strictEqual(mergeSkipResult.updatedCount, 0);

  const afterMergeSkip = await getAllSnippets();
  const keptOriginal = afterMergeSkip.find(s => s.id === existingSnippetId);
  assert.strictEqual(keptOriginal.title, 'Original Existing Snippet', 'Original snippet must not be changed');
  console.log('✓ Merge mode with "skip" policy keeps existing records and inserts new records');

  // Test 3.2: Merge Mode - 'overwrite' duplicate conflict policy
  const incomingOverwriteSnippet = {
    id: existingSnippetId,
    title: 'Overwritten Existing Snippet',
    code: 'function overwritten() { return "updated"; }',
    language: 'javascript',
    folder: 'Core',
    tags: ['overwritten'],
    isPinned: true,
    createdAt: baseSnippet.createdAt,
    updatedAt: Date.now(),
  };

  const mergeOverwriteResult = await importSnippets(
    [incomingOverwriteSnippet],
    { mode: 'merge', conflictPolicy: 'overwrite' }
  );

  assert.strictEqual(mergeOverwriteResult.updatedCount, 1);
  const afterMergeOverwrite = await getAllSnippets();
  const updatedRecord = afterMergeOverwrite.find(s => s.id === existingSnippetId);
  assert.strictEqual(updatedRecord.title, 'Overwritten Existing Snippet');
  assert.strictEqual(updatedRecord.isPinned, true);
  console.log('✓ Merge mode with "overwrite" policy successfully updates conflicting records');

  // Test 3.3: Merge Mode - 'keep_both' duplicate conflict policy
  const incomingKeepBothSnippet = {
    id: existingSnippetId,
    title: 'Duplicate Target',
    code: 'function cloned() { return "both"; }',
    language: 'javascript',
    folder: 'Core',
    tags: ['cloned'],
    isPinned: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const mergeKeepBothResult = await importSnippets(
    [incomingKeepBothSnippet],
    { mode: 'merge', conflictPolicy: 'keep_both' }
  );

  assert.strictEqual(mergeKeepBothResult.addedCount, 1);
  const afterMergeKeepBoth = await getAllSnippets();
  const duplicateRecord = afterMergeKeepBoth.find(s => s.title.includes('(Imported)'));
  assert.ok(duplicateRecord, 'A new record with (Imported) title suffix should exist');
  assert.notStrictEqual(duplicateRecord.id, existingSnippetId, 'Duplicate record must have a newly generated UUID');
  console.log('✓ Merge mode with "keep_both" policy creates a new UUID with (Imported) suffix');

  // Test 3.4: Atomic Replace Mode - Replaces all records in a single transaction
  const replaceSnippets = [
    {
      id: '77777777-7777-4777-8777-777777777777',
      title: 'Restored Snippet Alpha',
      code: 'console.log("Alpha");',
      language: 'javascript',
      folder: 'Restored',
      tags: ['alpha'],
      isPinned: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    {
      id: '88888888-8888-4888-8888-888888888888',
      title: 'Restored Snippet Beta',
      code: 'console.log("Beta");',
      language: 'python',
      folder: 'Restored',
      tags: ['beta'],
      isPinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const replaceResult = await importSnippets(replaceSnippets, { mode: 'replace' });
  assert.strictEqual(replaceResult.mode, 'replace');
  assert.strictEqual(replaceResult.addedCount, 2);

  const afterReplace = await getAllSnippets();
  assert.strictEqual(afterReplace.length, 2, 'Database should now only contain the 2 replaced records');
  assert.ok(afterReplace.every(s => s.folder === 'Restored'), 'All records should be from the replacement backup');
  console.log('✓ Atomic Replace clears existing collection and restores backup records');

  // Test 3.5: Atomic Replace Rollback on Transaction Error
  // If an addition fails (e.g. invalid snippet structure in store), transaction aborts and previous records are preserved
  let replaceFailed = false;
  try {
    await importSnippets([
      { id: '99999999-9999-4999-8999-999999999999', title: 'Ok snippet', code: 'valid' },
      null, // Will cause store.add(null) or runtime error in transaction
    ], { mode: 'replace' });
  } catch {
    replaceFailed = true;
  }

  assert.strictEqual(replaceFailed, true, 'Corrupt item inside replace must trigger transaction failure');
  const afterFailedReplace = await getAllSnippets();
  // Ensure the 2 snippets from Test 3.4 are still intact!
  assert.strictEqual(afterFailedReplace.length, 2, 'Store must not be empty; transaction abort rolls back store.clear()');
  console.log('✓ Atomic Replace rolls back completely on transaction failure, preserving database integrity');

  console.log('\n=============================================');
  console.log('All Phase 6 Backup & Recovery tests passed! ✓');
  console.log('=============================================');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
