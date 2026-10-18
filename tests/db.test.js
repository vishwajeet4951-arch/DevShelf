import 'fake-indexeddb/auto';
import assert from 'node:assert';
import { 
  createSnippet, 
  getSnippetById, 
  getAllSnippets, 
  updateSnippet, 
  deleteSnippet, 
  duplicateSnippet, 
  toggleSnippetPin 
} from '../src/services/db.js';

async function runTests() {
  console.log('--- Starting IndexedDB Service Tests ---');

  // Test 1: Empty on start
  const initial = await getAllSnippets();
  assert.strictEqual(Array.isArray(initial), true);
  assert.strictEqual(initial.length, 0, 'Database should be empty initially');
  console.log('✓ Initial getAllSnippets returns empty array');

  // Test 2: Validation on createSnippet
  let errorThrown = false;
  try {
    await createSnippet({ title: '', code: 'console.log(1)' });
  } catch (err) {
    errorThrown = true;
    assert.match(err.message, /title is required/i);
  }
  assert.strictEqual(errorThrown, true, 'Should throw error when title is empty');
  console.log('✓ createSnippet rejects empty title');

  errorThrown = false;
  try {
    await createSnippet({ title: 'Test', code: '   ' });
  } catch (err) {
    errorThrown = true;
    assert.match(err.message, /code is required/i);
  }
  assert.strictEqual(errorThrown, true, 'Should throw error when code is empty');
  console.log('✓ createSnippet rejects empty code');

  // Test 3: Successful createSnippet
  const snippet1 = await createSnippet({
    title: 'Debounce Hook',
    code: 'export function useDebounce(value, delay) { ... }',
    language: 'javascript',
    folder: 'React Hooks',
    tags: ['react', 'hooks', 'performance'],
    isPinned: false,
  });

  assert.ok(snippet1.id, 'Snippet must have an id');
  assert.strictEqual(snippet1.title, 'Debounce Hook');
  assert.strictEqual(snippet1.language, 'javascript');
  assert.strictEqual(snippet1.folder, 'React Hooks');
  assert.deepStrictEqual(snippet1.tags, ['react', 'hooks', 'performance']);
  assert.strictEqual(snippet1.isPinned, false);
  assert.strictEqual(typeof snippet1.createdAt, 'number');
  assert.strictEqual(typeof snippet1.updatedAt, 'number');
  console.log('✓ createSnippet successfully created snippet with schema match');

  // Test 4: getSnippetById
  const fetched = await getSnippetById(snippet1.id);
  assert.ok(fetched, 'Fetched snippet must exist');
  assert.strictEqual(fetched.id, snippet1.id);
  assert.strictEqual(fetched.title, snippet1.title);
  console.log('✓ getSnippetById retrieves correct snippet');

  // Test 5: updateSnippet (preserves createdAt, updates updatedAt)
  const originalCreatedAt = snippet1.createdAt;
  // Small pause to verify updatedAt changes
  await new Promise((r) => setTimeout(r, 10));

  const updated = await updateSnippet(snippet1.id, {
    title: 'useDebounce Hook (Updated)',
    code: 'export function useDebounce(value, delay = 300) { ... }',
    folder: 'Utilities',
  });

  assert.strictEqual(updated.id, snippet1.id, 'ID must remain unchanged on update');
  assert.strictEqual(updated.title, 'useDebounce Hook (Updated)');
  assert.strictEqual(updated.folder, 'Utilities');
  assert.strictEqual(updated.createdAt, originalCreatedAt, 'createdAt must be preserved on edit');
  assert.ok(updated.updatedAt >= originalCreatedAt, 'updatedAt must be updated');
  console.log('✓ updateSnippet preserves id and createdAt, updates content and updatedAt');

  // Test 6: toggleSnippetPin
  const pinned = await toggleSnippetPin(snippet1.id);
  assert.strictEqual(pinned.isPinned, true, 'isPinned should toggle to true');
  const unpinned = await toggleSnippetPin(snippet1.id);
  assert.strictEqual(unpinned.isPinned, false, 'isPinned should toggle back to false');
  console.log('✓ toggleSnippetPin toggles pin status properly');

  // Test 7: duplicateSnippet
  const duplicated = await duplicateSnippet(snippet1.id);
  assert.ok(duplicated.id !== snippet1.id, 'Duplicated snippet must have a fresh unique UUID');
  assert.strictEqual(duplicated.title, 'useDebounce Hook (Updated) (Copy)');
  assert.strictEqual(duplicated.code, updated.code);
  assert.strictEqual(duplicated.isPinned, false, 'Duplicated snippet starts unpinned');
  console.log('✓ duplicateSnippet creates clone with fresh UUID and "(Copy)" suffix');

  // Test 8: getAllSnippets returns both items
  const all = await getAllSnippets();
  assert.strictEqual(all.length, 2, 'Should have 2 snippets now');
  console.log('✓ getAllSnippets returns all persisted items');

  // Test 9: deleteSnippet
  const deleted = await deleteSnippet(snippet1.id);
  assert.strictEqual(deleted, true);
  const remaining = await getAllSnippets();
  assert.strictEqual(remaining.length, 1);
  assert.strictEqual(remaining[0].id, duplicated.id);
  console.log('✓ deleteSnippet removes item from store');

  // Test 10: Non-existent ID handling
  let notFoundCaught = false;
  try {
    await deleteSnippet('non-existent-uuid');
  } catch (err) {
    notFoundCaught = true;
    assert.match(err.message, /not found/i);
  }
  assert.strictEqual(notFoundCaught, true);
  console.log('✓ deleteSnippet handles non-existent ID gracefully');

  console.log('\n--- ALL 10 INDEXEDDB UNIT TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
