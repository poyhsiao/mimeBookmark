'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/use-user';
import { signOut } from '@/lib/auth/client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { BookMarked, LayoutDashboard, FolderOpen, Tags, Settings, LogOut, User } from 'lucide-react';
import { AnalyticsProvider } from '@/lib/analytics';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <AnalyticsProvider />
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 border-r bg-card">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-4 border-b">
            <Link href="/dashboard" className="flex items-center gap-2">
              <BookMarked className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">MimeBookmark</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/collections"
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <FolderOpen className="h-4 w-4" />
              Collections
            </Link>
            <Link
              href="/dashboard/bookmarks"
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <BookMarked className="h-4 w-4" />
              Bookmarks
            </Link>
            <Link
              href="/dashboard/tags"
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Tags className="h-4 w-4" />
              Tags
            </Link>
          </nav>

          <Separator />

          {/* Bottom section */}
          <div className="p-4 space-y-1">
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <div className="flex items-center gap-3 px-3 py-2 text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="text-sm truncate">{user.email}</span>
            </div>
            <form action={async () => {
              await signOut();
              router.push('/');
              router.refresh();
            }}>
              <Button
                type="submit"
                variant="ghost"
                className="w-full justify-start gap-3 px-3 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="pl-64">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
