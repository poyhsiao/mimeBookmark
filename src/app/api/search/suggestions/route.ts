import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeSearchTerm } from '@/lib/utils/sanitize-search';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';
  const limitRaw = searchParams.get('limit') || '5';
  
  // Parse and validate limit
  const parsedLimit = Number.parseInt(limitRaw, 10);
  const limit = Number.isNaN(parsedLimit) ? 5 : Math.min(50, Math.max(1, parsedLimit));

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    // Sanitize search term for PostgREST filter syntax
    const searchTerm = sanitizeSearchTerm(query);

    const { data: bookmarks, error } = await supabase
      .from('bookmarks')
      .select('id, title, url, domain', { count: 'exact' })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(
        `title.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%`
      )
      .eq('is_archived', false)
      .order('title', { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) {
      console.error('Suggestions error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    const suggestions = bookmarks?.map(bookmark => ({
      id: bookmark.id,
      title: bookmark.title || bookmark.url,
      url: bookmark.url,
      domain: bookmark.domain,
      type: 'bookmark',
    })) || [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Suggestions error:', error);
    return NextResponse.json({ error: 'Failed to get suggestions' }, { status: 500 });
  }
}
