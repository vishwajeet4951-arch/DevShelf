import { useState, useEffect } from 'react';

/**
 * Registers the production Service Worker (/sw.js) for offline shell caching.
 * Only runs in production environment; never interferes with Vite dev server or HMR.
 */
export function registerServiceWorker() {
  if (import.meta.env.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Listen for available updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker == null) return;

            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  // New update available
                  console.log('[DevShelf PWA] New version installed and ready for next visit.');
                } else {
                  // Content is cached for offline use
                  console.log('[DevShelf PWA] Content is cached for offline use.');
                }
              }
            };
          };
        })
        .catch((error) => {
          console.error('[DevShelf PWA] Service worker registration failed:', error);
        });
    });
  }
}

/**
 * Custom React hook to track real-time online/offline network connectivity.
 * @returns {boolean} True if online, false if offline
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    return typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean'
      ? navigator.onLine
      : true;
  });

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
