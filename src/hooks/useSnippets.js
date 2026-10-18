import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getAllSnippets, 
  createSnippet, 
  updateSnippet, 
  deleteSnippet, 
  duplicateSnippet, 
  toggleSnippetPin,
  importSnippets
} from '../services/db';

/**
 * Custom React hook for snippet management backed by IndexedDB.
 * Manages loading, error states, and optimistic-safe synchronization.
 */
export function useSnippets() {
  const [snippets, setSnippets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Track active fetch requests to avoid race conditions or stale state
  const requestIdRef = useRef(0);

  const loadSnippets = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setError(null);

    try {
      const items = await getAllSnippets();
      if (currentRequestId === requestIdRef.current) {
        setSnippets(items);
        setLoading(false);
      }
    } catch (err) {
      if (currentRequestId === requestIdRef.current) {
        console.error('Failed to load snippets from IndexedDB:', err);
        setError(err.message || 'Failed to load snippets');
        setLoading(false);
      }
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    let ignore = false;
    const currentRequestId = ++requestIdRef.current;

    getAllSnippets()
      .then((items) => {
        if (!ignore && currentRequestId === requestIdRef.current) {
          setSnippets(items);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore && currentRequestId === requestIdRef.current) {
          console.error('Failed to load snippets from IndexedDB:', err);
          setError(err.message || 'Failed to load snippets');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  /**
   * Adds a new snippet
   */
  const addSnippet = useCallback(async (snippetData) => {
    setError(null);
    try {
      const created = await createSnippet(snippetData);
      setSnippets((prev) => [created, ...prev]);
      return created;
    } catch (err) {
      console.error('Error creating snippet:', err);
      setError(err.message || 'Error creating snippet');
      throw err;
    }
  }, []);

  /**
   * Updates an existing snippet
   */
  const editSnippet = useCallback(async (id, updates) => {
    setError(null);
    try {
      const updated = await updateSnippet(id, updates);
      setSnippets((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (err) {
      console.error('Error updating snippet:', err);
      setError(err.message || 'Error updating snippet');
      throw err;
    }
  }, []);

  /**
   * Deletes a snippet
   */
  const removeSnippet = useCallback(async (id) => {
    setError(null);
    try {
      await deleteSnippet(id);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
      return true;
    } catch (err) {
      console.error('Error deleting snippet:', err);
      setError(err.message || 'Error deleting snippet');
      throw err;
    }
  }, []);

  /**
   * Duplicates an existing snippet
   */
  const cloneSnippet = useCallback(async (id) => {
    setError(null);
    try {
      const duplicated = await duplicateSnippet(id);
      setSnippets((prev) => [duplicated, ...prev]);
      return duplicated;
    } catch (err) {
      console.error('Error duplicating snippet:', err);
      setError(err.message || 'Error duplicating snippet');
      throw err;
    }
  }, []);

  /**
   * Toggles the pin status of a snippet
   */
  const togglePin = useCallback(async (id) => {
    setError(null);
    try {
      const updated = await toggleSnippetPin(id);
      setSnippets((prev) => prev.map((s) => (s.id === id ? updated : s)));
      return updated;
    } catch (err) {
      console.error('Error toggling snippet pin:', err);
      setError(err.message || 'Error toggling snippet pin');
      throw err;
    }
  }, []);

  /**
   * Imports validated snippets into IndexedDB and refreshes the state.
   */
  const importBackup = useCallback(async (validatedSnippets, options = {}) => {
    setError(null);
    try {
      const result = await importSnippets(validatedSnippets, options);
      await loadSnippets();
      return result;
    } catch (err) {
      console.error('Error importing backup snippets:', err);
      setError(err.message || 'Error importing backup snippets');
      throw err;
    }
  }, [loadSnippets]);

  return {
    snippets,
    loading,
    error,
    addSnippet,
    editSnippet,
    removeSnippet,
    cloneSnippet,
    togglePin,
    importBackup,
    refresh: loadSnippets,
  };
}
