import React, { useState, useCallback, useMemo } from 'react';
import { ThemeProvider } from './context/ThemeProvider';
import AppLayout from './components/layout/AppLayout';
import SnippetList from './components/snippets/SnippetList';
import SnippetModal from './components/snippets/SnippetModal';
import SnippetDetailModal from './components/snippets/SnippetDetailModal';
import DeleteConfirmModal from './components/snippets/DeleteConfirmModal';
import CommandPalette from './components/CommandPalette';
import ImportModal from './components/backup/ImportModal';
import Toast from './components/common/Toast';
import { useSnippets } from './hooks/useSnippets';
import { useCommandPalette } from './hooks/useCommandPalette';
import { exportSnippetsToJson } from './utils/exportUtils';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState(null);
  const [deletingSnippet, setDeletingSnippet] = useState(null);
  const [detailSnippetId, setDetailSnippetId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [openedFromPalette, setOpenedFromPalette] = useState(false);

  const {
    isOpen: isPaletteOpen,
    openPalette,
    closePalette,
  } = useCommandPalette();

  const {
    snippets,
    loading,
    error: dbError,
    addSnippet,
    editSnippet,
    removeSnippet,
    cloneSnippet,
    togglePin,
    importBackup,
    refresh
  } = useSnippets();

  // Find currently selected detail snippet dynamically from live snippets array
  const selectedDetailSnippet = useMemo(() => {
    if (!detailSnippetId) return null;
    return snippets.find((s) => s.id === detailSnippetId) || null;
  }, [snippets, detailSnippetId]);

  const showToast = useCallback((message, type = 'success', title = '') => {
    setToast({ message, type, title, duration: 3500 });
  }, []);

  const handleOpenCreateModal = useCallback(() => {
    setEditingSnippet(null);
    setIsSnippetModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((snippet) => {
    setEditingSnippet(snippet);
    setIsSnippetModalOpen(true);
  }, []);

  const handleSaveSnippet = async (formData) => {
    try {
      if (formData.id) {
        await editSnippet(formData.id, formData);
        showToast('Snippet updated successfully in IndexedDB', 'success', 'Saved');
      } else {
        await addSnippet(formData);
        showToast('New snippet saved securely to IndexedDB', 'success', 'Created');
      }
    } catch (err) {
      showToast(err.message || 'Failed to save snippet', 'error', 'Save Error');
      throw err;
    }
  };

  const handlePromptDelete = useCallback((snippet) => {
    setDeletingSnippet(snippet);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deletingSnippet) return;
    setIsDeleting(true);
    try {
      await removeSnippet(deletingSnippet.id);
      showToast(`Deleted "${deletingSnippet.title}"`, 'info', 'Removed');
      if (detailSnippetId === deletingSnippet.id) {
        setDetailSnippetId(null);
      }
      setDeletingSnippet(null);
    } catch (err) {
      showToast(err.message || 'Failed to delete snippet', 'error', 'Error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDuplicateSnippet = async (id) => {
    try {
      const duplicated = await cloneSnippet(id);
      showToast(`Created duplicate "${duplicated.title}"`, 'success', 'Duplicated');
    } catch (err) {
      showToast(err.message || 'Failed to duplicate snippet', 'error', 'Error');
    }
  };

  const handleTogglePin = async (id) => {
    try {
      const updated = await togglePin(id);
      showToast(
        updated.isPinned ? `Pinned "${updated.title}"` : `Unpinned "${updated.title}"`,
        'info'
      );
    } catch (err) {
      showToast(err.message || 'Failed to update pin', 'error', 'Error');
    }
  };

  const handleCopyCode = (message, type = 'success') => {
    showToast(message, type);
  };

  const handleSelectSnippetFromPalette = useCallback((snippet) => {
    setOpenedFromPalette(true);
    closePalette();
    setDetailSnippetId(snippet.id);
  }, [closePalette]);

  const handleCloseDetailModal = useCallback(() => {
    setDetailSnippetId(null);
    if (openedFromPalette) {
      setOpenedFromPalette(false);
      openPalette();
    }
  }, [openedFromPalette, openPalette]);

  const handleExportJson = useCallback(() => {
    try {
      const result = exportSnippetsToJson(snippets);
      if (result.sensitiveCount > 0) {
        showToast(
          `Exported ${result.count} snippets (${result.sensitiveCount} contain unmasked credentials) to ${result.fileName}. Keep backup file secure!`,
          'info',
          'Export Complete'
        );
      } else {
        showToast(`Exported ${result.count} snippets to ${result.fileName}`, 'success', 'Export Complete');
      }
    } catch (err) {
      showToast(err.message || 'Failed to export snippets', 'error', 'Export Failed');
    }
  }, [snippets, showToast]);

  const handleImportBackup = useCallback(async (validatedSnippets, options) => {
    try {
      const result = await importBackup(validatedSnippets, options);
      if (result.mode === 'replace') {
        showToast(
          `Successfully replaced all snippets with ${result.addedCount} items from backup`,
          'success',
          'Restore Complete'
        );
      } else {
        const details = [];
        if (result.addedCount > 0) details.push(`${result.addedCount} added`);
        if (result.updatedCount > 0) details.push(`${result.updatedCount} updated`);
        if (result.skippedCount > 0) details.push(`${result.skippedCount} skipped`);
        showToast(
          `Import finished: ${details.join(', ') || '0 changes'}`,
          'success',
          'Import Complete'
        );
      }
      return result;
    } catch (err) {
      showToast(err.message || 'Import failed', 'error', 'Import Error');
      throw err;
    }
  }, [importBackup, showToast]);

  return (
    <ThemeProvider>
      <AppLayout 
        activeFilter={activeFilter} 
        onSelectFilter={setActiveFilter}
        snippets={snippets}
        onNewSnippet={handleOpenCreateModal}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={() => setSearchQuery('')}
        onOpenCommandPalette={openPalette}
        onExportJson={handleExportJson}
        onOpenImport={() => setIsImportModalOpen(true)}
      >
        {/* Error notification if IndexedDB fails */}
        {dbError && (
          <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Database error: {dbError}</span>
            </div>
            <button
              type="button"
              onClick={refresh}
              className="underline hover:no-underline font-medium text-rose-600 dark:text-rose-400"
            >
              Retry
            </button>
          </div>
        )}

        {/* Central Workspace: Filtered Snippet List & Empty State */}
        <SnippetList
          snippets={snippets}
          loading={loading}
          activeFilter={activeFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onSelectFilter={setActiveFilter}
          onNewSnippet={handleOpenCreateModal}
          onSelectSnippet={(snippet) => setDetailSnippetId(snippet.id)}
          onEdit={handleOpenEditModal}
          onDelete={handlePromptDelete}
          onDuplicate={handleDuplicateSnippet}
          onTogglePin={handleTogglePin}
          onCopy={handleCopyCode}
        />

        {/* Full Snippet Detail & Code Viewer Modal */}
        <SnippetDetailModal
          key={selectedDetailSnippet?.id || 'none'}
          isOpen={Boolean(selectedDetailSnippet)}
          snippet={selectedDetailSnippet}
          onClose={handleCloseDetailModal}
          onEdit={(snippet) => {
            setOpenedFromPalette(false);
            handleOpenEditModal(snippet);
          }}
          onDelete={(snippet) => {
            setOpenedFromPalette(false);
            handlePromptDelete(snippet);
          }}
          onDuplicate={handleDuplicateSnippet}
          onTogglePin={handleTogglePin}
          onSelectTag={(tag) => {
            setOpenedFromPalette(false);
            setActiveFilter(`tag:${tag}`);
          }}
          onCopy={handleCopyCode}
        />

        {/* Create / Edit Snippet Modal */}
        <SnippetModal
          isOpen={isSnippetModalOpen}
          onClose={() => setIsSnippetModalOpen(false)}
          onSave={handleSaveSnippet}
          initialData={editingSnippet}
        />

        {/* Permanent Delete Confirmation Dialog */}
        <DeleteConfirmModal
          isOpen={Boolean(deletingSnippet)}
          snippetTitle={deletingSnippet?.title || ''}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingSnippet(null)}
          isDeleting={isDeleting}
        />

        {/* Import JSON Backup Modal */}
        <ImportModal
          key={isImportModalOpen ? 'open' : 'closed'}
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          existingSnippets={snippets}
          onImport={handleImportBackup}
        />

        {/* Global Command Palette (Ctrl+K) */}
        {isPaletteOpen && (
          <CommandPalette
            isOpen={isPaletteOpen}
            onClose={closePalette}
            snippets={snippets}
            onSelectSnippet={handleSelectSnippetFromPalette}
            onNewSnippet={handleOpenCreateModal}
            onExportJson={handleExportJson}
            onOpenImport={() => setIsImportModalOpen(true)}
          />
        )}

        {/* Global Toast Feedback */}
        <Toast toast={toast} onClose={() => setToast(null)} />
      </AppLayout>
    </ThemeProvider>
  );
}
