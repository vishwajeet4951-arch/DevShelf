import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Custom hook to manage global Ctrl+K / Cmd+K shortcut,
 * palette open/close state, and focus restoration.
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const previouslyFocusedElementRef = useRef(null);

  const openPalette = useCallback(() => {
    previouslyFocusedElementRef.current = document.activeElement;
    setIsOpen(true);
  }, []);

  const closePalette = useCallback(() => {
    setIsOpen(false);
    // Restore focus to previous element if it is still connected
    setTimeout(() => {
      const prev = previouslyFocusedElementRef.current;
      if (prev && typeof prev.focus === 'function' && document.body.contains(prev)) {
        prev.focus();
      }
    }, 50);
  }, []);

  const togglePalette = useCallback(() => {
    if (isOpen) {
      closePalette();
    } else {
      openPalette();
    }
  }, [isOpen, openPalette, closePalette]);

  // Global keyboard listener for Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e) {
      // Check for Ctrl+K (Windows/Linux) or Meta+K (macOS)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        // Do not trigger if user is actively editing inside an unrelated modal or editor textarea
        const target = e.target;
        if (target && typeof target.closest === 'function') {
          const isModalInput = target.closest('[role="dialog"]') && !target.classList?.contains('cmd-palette-input');
          const isNormalTextarea = target.tagName === 'TEXTAREA' && !target.classList?.contains('cmd-palette-input');
          if (isModalInput || isNormalTextarea) {
            return;
          }
        }

        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            previouslyFocusedElementRef.current = document.activeElement;
            return true;
          }
          // If already open, close it and restore focus
          setTimeout(() => {
            const el = previouslyFocusedElementRef.current;
            if (el && typeof el.focus === 'function' && document.body.contains(el)) {
              el.focus();
            }
          }, 50);
          return false;
        });
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    openPalette,
    closePalette,
    togglePalette,
    previouslyFocusedElementRef,
  };
}
