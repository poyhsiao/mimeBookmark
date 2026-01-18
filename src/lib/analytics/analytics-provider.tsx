'use client';

import { useEffect, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

function PageTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    const url = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');
    trackPageView({ url, referrer: typeof document !== 'undefined' ? document.referrer : undefined });
  }, [pathname, searchParams]);

  return null;
}

export default function AnalyticsProvider() {
  return (
    <Suspense fallback={null}>
      <PageTracker />
    </Suspense>
  );
}
