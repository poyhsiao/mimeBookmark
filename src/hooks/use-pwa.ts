'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function usePWA() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    // Check for service worker updates
    let registration: ServiceWorkerRegistration | null = null;
    let installingWorkerStateChangeHandler: (() => void) | null = null;
    let previousInstallingWorker: ServiceWorker | null = null;

    const handleUpdateFound = () => {
      if (!registration?.installing) return;

      const installingWorker = registration.installing;

      // Remove previous listener if exists
      if (installingWorkerStateChangeHandler && previousInstallingWorker) {
        previousInstallingWorker.removeEventListener('statechange', installingWorkerStateChangeHandler);
      }

      installingWorkerStateChangeHandler = () => {
        if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
          if (isMounted) {
            setNeedsRefresh(true);
          }
        }
      };

      installingWorker.addEventListener('statechange', installingWorkerStateChangeHandler);
      previousInstallingWorker = installingWorker;
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (!isMounted) return;

        registration = reg;
        setServiceWorkerRegistration(reg);
        reg.addEventListener('updatefound', handleUpdateFound);
      });
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      isMounted = false;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (registration) {
        registration.removeEventListener('updatefound', handleUpdateFound);
      }
      // Clean up statechange listener to avoid memory leaks
      if (installingWorkerStateChangeHandler && previousInstallingWorker) {
        previousInstallingWorker.removeEventListener('statechange', installingWorkerStateChangeHandler);
      }
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return false;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === 'accepted') {
      setInstallPrompt(null);
      return true;
    }

    return false;
  };

  const updateServiceWorker = () => {
    if (serviceWorkerRegistration?.waiting) {
      const waiting = serviceWorkerRegistration.waiting;
      let hasReloaded = false;
      let timeoutId: NodeJS.Timeout | null = null;

      // Listen for controller change
      const handleControllerChange = () => {
        if (!hasReloaded) {
          hasReloaded = true;
          if (timeoutId) clearTimeout(timeoutId);
          window.location.reload();
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });

      // Send skip waiting message
      waiting.postMessage({ type: 'SKIP_WAITING' });

      // Fallback timeout in case controllerchange doesn't fire
      timeoutId = setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        if (!hasReloaded) {
          hasReloaded = true;
          window.location.reload();
        }
      }, 3000);

      // Return cleanup function
      return () => {
        if (timeoutId) clearTimeout(timeoutId);
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      };
    }
    return () => {}; // Return no-op cleanup if no waiting worker
  };

  return {
    isInstalled,
    canInstall: !!installPrompt,
    install,
    needsRefresh,
    updateServiceWorker
  };
}
