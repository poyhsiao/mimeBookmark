import { useEffect, useState } from 'react';

export function useE2ETestMode() {
  const [isE2ETesting, setIsE2ETesting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const flag = localStorage.getItem('e2e-test-mode') === 'true';
    const globalMock = (window as any).__E2E_MOCK_AUTH__ === true;

    setIsE2ETesting(flag || globalMock);
    setIsMounted(true);
  }, []);

  return { isE2ETesting, isMounted };
}
