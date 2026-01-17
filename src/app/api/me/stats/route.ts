import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [bookmarksResult, collectionsResult, tagsResult] = await Promise.all([
      supabase
        .from('bookmarks')
        .select('id, is_archived, is_favorite, is_read_later, created_at', { count: 'exact' })
        .eq('user_id', user.id)
        .is('deleted_at', null),
      supabase
        .from('collections')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .is('deleted_at', null),
      supabase
        .from('tags')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)
        .is('deleted_at', null),
    ]);

    // Check for errors in query results
    if (bookmarksResult.error) {
      return NextResponse.json({ error: bookmarksResult.error.message }, { status: 500 });
    }
    if (collectionsResult.error) {
      return NextResponse.json({ error: collectionsResult.error.message }, { status: 500 });
    }
    if (tagsResult.error) {
      return NextResponse.json({ error: tagsResult.error.message }, { status: 500 });
    }

    const bookmarks = bookmarksResult.data || [];
    const collections = collectionsResult.data || [];
    const tags = tagsResult.data || [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const stats = {
      totalBookmarks: bookmarksResult.count || 0,
      archivedBookmarks: bookmarks.filter(b => b.is_archived).length,
      favoriteBookmarks: bookmarks.filter(b => b.is_favorite).length,
      readLaterBookmarks: bookmarks.filter(b => b.is_read_later).length,
      bookmarksLast30Days: bookmarks.filter(b =>
        new Date(b.created_at) >= thirtyDaysAgo
      ).length,
      bookmarksLast7Days: bookmarks.filter(b =>
        new Date(b.created_at) >= sevenDaysAgo
      ).length,
      totalCollections: collectionsResult.count || 0,
      totalTags: tagsResult.count || 0,
      storageUsed: 0,
    };

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
