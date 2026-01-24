import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { escapeLikePattern } from '@/lib/utils/sql-escape';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limitParam = searchParams.get('limit') || '10';
    const limit = Math.max(1, Math.min(parseInt(limitParam, 10) || 10, 100));
    const type = searchParams.get('type') || 'all';

    if (!query || query.length < 2) {
      return NextResponse.json({ results: [], suggestions: [] });
    }

    const searchQuery = escapeLikePattern(query.toLowerCase());
    
    // Deterministic hash function for scoring
    const getHashScore = (id: string, query: string, range: number): number => {
      let hash = 0;
      const str = id + query;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return Math.abs(hash % (range * 100)) / 100;
    };
    
    const results: Array<{
      type: 'bookmark' | 'collection' | 'tag';
      id: string;
      title: string;
      url?: string;
      description?: string;
      favicon?: string;
      collection?: string;
      tags?: string[];
      score: number;
    }> = [];

    if (type === 'all' || type === 'bookmark') {
      const { data: bookmarks } = await supabase
        .from('bookmarks')
        .select(`
          id,
          url,
          title,
          description,
          favicon_url,
          domain,
          tags:bookmark_tags(tags(name))
        `)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(`title.ilike.%${searchQuery}%,url.ilike.%${searchQuery}%`)
        .limit(limit);

      if (bookmarks) {
        for (const bookmark of bookmarks) {
          const lowerQuery = searchQuery.toLowerCase();
          const titleMatch = bookmark.title?.toLowerCase().includes(lowerQuery) ? 10 : 0;
          const urlMatch = bookmark.url?.toLowerCase().includes(lowerQuery) ? 5 : 0;
          const deterministicBoost = getHashScore(bookmark.id, query, 3);
          const score = titleMatch + urlMatch + deterministicBoost;

          const tags = Array.isArray(bookmark.tags)
            ? bookmark.tags.map((t: Record<string, unknown>) => {
                const tagObj = t.tags as Record<string, unknown> | undefined;
                return tagObj?.name as string | undefined;
              }).filter((tag): tag is string => typeof tag === 'string')
            : [];

          results.push({
            type: 'bookmark',
            id: bookmark.id,
            title: bookmark.title || bookmark.url,
            url: bookmark.url,
            description: bookmark.description,
            favicon: bookmark.favicon_url,
            tags: tags as string[],
            score,
          });
        }
      }
    }

    if (type === 'all' || type === 'collection') {
      const { data: collections } = await supabase
        .from('collections')
        .select('id, name, description, color')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .ilike('name', `%${searchQuery}%`)
        .limit(Math.ceil(limit / 3));

      if (collections) {
        for (const collection of collections) {
          const deterministicBoost = getHashScore(collection.id, query, 2);
          const score = 8 + deterministicBoost;

          results.push({
            type: 'collection',
            id: collection.id,
            title: collection.name,
            description: collection.description,
            score,
          });
        }
      }
    }

    if (type === 'all' || type === 'tag') {
      const { data: tags } = await supabase
        .from('tags')
        .select('id, name, color, usage_count')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .ilike('name', `%${searchQuery}%`)
        .limit(Math.ceil(limit / 3));

      if (tags) {
        for (const tag of tags) {
          const deterministicBoost = getHashScore(tag.id, query, 2);
          const score = 6 + deterministicBoost;

          results.push({
            type: 'tag',
            id: tag.id,
            title: tag.name,
            score,
          });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    const suggestions: string[] = [];
    if (results.length > 0) {
      const topResults = results.slice(0, 3);
      for (const result of topResults) {
        if (result.title && !suggestions.includes(result.title)) {
          suggestions.push(result.title);
        }
        if (result.tags) {
          for (const tag of result.tags) {
            if (!suggestions.includes(tag) && suggestions.length < 5) {
              suggestions.push(tag);
            }
          }
        }
      }
    }

    return NextResponse.json({
      query,
      results: results.slice(0, limit),
      suggestions: suggestions.slice(0, 5),
      count: results.length,
    });
  } catch (error) {
    console.error('Extension search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
