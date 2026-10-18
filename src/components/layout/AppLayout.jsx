import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

export default function AppLayout({ 
  children, 
  activeFilter, 
  onSelectFilter,
  snippets = [],
  onNewSnippet,
  searchQuery,
  onSearchChange,
  onClearSearch,
  onOpenCommandPalette,
  onExportJson,
  onOpenImport
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isDesktopSidebarCollapsed, setIsDesktopSidebarCollapsed] = useState(false);

  // Close mobile sidebar on Escape key press
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && isMobileSidebarOpen) {
        setIsMobileSidebarOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileSidebarOpen]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-dev-bg-light dark:bg-dev-bg-dark text-slate-800 dark:text-slate-100">
      {/* Top Navbar */}
      <Navbar 
        onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onNewSnippet={onNewSnippet}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onClearSearch={onClearSearch}
        onOpenCommandPalette={onOpenCommandPalette}
        onExportJson={onExportJson}
        onOpenImport={onOpenImport}
      />

      {/* Main Body: Sidebar + Workspace */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isCollapsed={isDesktopSidebarCollapsed}
          onToggleCollapse={() => setIsDesktopSidebarCollapsed(!isDesktopSidebarCollapsed)}
          activeFilter={activeFilter}
          onSelectFilter={(filter) => {
            onSelectFilter?.(filter);
            setIsMobileSidebarOpen(false);
          }}
          snippets={snippets}
        />

        {/* Central Workspace Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-slate-50/50 dark:bg-dev-bg-dark/60">
          {children}
        </main>
      </div>
    </div>
  );
}
