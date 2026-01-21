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
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    let registration: ServiceWorkerRegistration | null = null;

    const handleUpdateFound = () => {
      const installing = registration?.installing;
      if (!installing) return;

      const onStateChange = () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          setNeedsRefresh(true);
        }
      };

      installing.addEventListener('statechange', onStateChange, { once: true });
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        registration = reg;
        setServiceWorkerRegistration(reg);

        if (reg.waiting && navigator.serviceWorker.controller) {
          setNeedsRefresh(true);
        }

        reg.addEventListener('updatefound', handleUpdateFound);
      });
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (registration) {
        registration.removeEventListener('updatefound', handleUpdateFound);
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
      const timeoutId = setTimeout(() => {
        if (!hasReloaded) {
          hasReloaded = true;
          window.location.reload();
        }
      }, 3000);

      const handleControllerChange = () => {
        if (!hasReloaded) {
          hasReloaded = true;
          clearTimeout(timeoutId);
          window.location.reload();
        }
      };

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
      waiting.postMessage({ type: 'SKIP_WAITING' });

      return () => {
        clearTimeout(timeoutId);
      };
    }
    return () => {};
  };

  return {
    isInstalled,
    canInstall: !!installPrompt,
    install,
    needsRefresh,
    updateServiceWorker
  };
}
