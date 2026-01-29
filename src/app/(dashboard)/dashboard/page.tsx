import { getCurrentUser } from '@/lib/auth/server';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderOpen, Tags, BookMarked, Plus } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { BookmarksSection } from '@/components/bookmarks/bookmarks-section';
import { CollectionsSection } from '@/components/collections/collections-section';
import { TagsSection } from '@/components/tags/tags-section';
import Link from 'next/link';

export default async function DashboardPage() {
  const userResult = await getCurrentUser();
  const user = userResult.user;

  // Guard against missing user - redirect to login
  if (!user) {
    redirect('/login');
  }

  // Check if running in E2E test mode (only in non-production environments)
  const isE2ETesting = process.env.E2E_USE_MOCK === 'true' && process.env.NODE_ENV !== 'production';

  let stats = {
    collections: 0,
    bookmarks: 0,
    tags: 0,
  };

  // Only fetch from database if not in E2E test mode
  if (!isE2ETesting) {
    const supabase = await createClient();

    const [collectionsResult, bookmarksResult, tagsResult] = await Promise.all([
      supabase.from('collections').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
      supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
      supabase.from('tags').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
    ]);

    const errors = [collectionsResult.error, bookmarksResult.error, tagsResult.error].filter(Boolean);
    if (errors.length) {
      console.error('Dashboard stats error:', errors);
      throw new Error('Failed to load dashboard stats');
    }

    stats = {
      collections: collectionsResult.count || 0,
      bookmarks: bookmarksResult.count || 0,
      tags: tagsResult.count || 0,
    };
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.email}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collections</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.collections}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bookmarks</CardTitle>
            <BookMarked className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.bookmarks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags</CardTitle>
            <Tags className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.tags}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Collections</h2>
          <Link href="/dashboard/collections">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>
        <CollectionsSection showHeader={false} limit={3} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Tags</h2>
          <Link href="/dashboard/tags">
            <Button variant="outline" size="sm">View All</Button>
          </Link>
        </div>
        <TagsSection showHeader={false} limit={3} />
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Recent Bookmarks</h2>
        <BookmarksSection />
      </div>
    </div>
  );
}
