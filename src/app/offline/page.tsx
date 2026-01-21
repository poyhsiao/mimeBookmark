'use client';

import Link from 'next/link';
import { WifiOff, Home, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-muted rounded-full p-6 mb-6">
        <WifiOff className="w-12 h-12 text-muted-foreground" />
      </div>

      <h1 className="text-2xl font-bold mb-2">You&apos;re Offline</h1>
      <p className="text-muted-foreground mb-6 max-w-md">
        It looks like you&apos;ve lost your internet connection. Don&apos;t worry, 
        your bookmarks are safely stored locally and will sync when you&apos;re back online.
      </p>

      <div className="flex gap-4">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-accent transition-colors"
        >
          <Home className="w-4 h-4" />
          Go Home
        </Link>
      </div>

      <div className="mt-12 p-4 bg-muted/50 rounded-lg max-w-md">
        <h2 className="font-semibold mb-2">While you&apos;re offline, you can:</h2>
        <ul className="text-sm text-muted-foreground text-left space-y-2">
          <li>• View your previously loaded bookmarks</li>
          <li>• Search through cached bookmarks</li>
          <li>• Organize your collections (changes will sync later)</li>
          <li>• Read your saved articles and pages</li>
        </ul>
      </div>
    </div>
  );
}
