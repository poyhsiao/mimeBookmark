import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHostnameFromUrl } from '@/lib/utils/sql-escape';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
      }
      throw error;
    }

    const { lastSyncTimestamp, bookmarks } = body;

    if (!lastSyncTimestamp) {
      return NextResponse.json({ error: 'Missing lastSyncTimestamp' }, { status: 400 });
    }

    // Validate timestamp format
    const parsedTimestamp = Date.parse(lastSyncTimestamp);
    if (isNaN(parsedTimestamp)) {
      return NextResponse.json({ error: 'Invalid lastSyncTimestamp' }, { status: 400 });
    }

    const validatedTimestamp = new Date(parsedTimestamp).toISOString();

    const syncResults = {
      uploaded: { bookmarks: 0, collections: 0, tags: 0 },
      downloaded: { bookmarks: [] as Array<Record<string, unknown>>, collections: [] as Array<Record<string, unknown>>, tags: [] as Array<Record<string, unknown>> },
      conflicts: [] as Array<{
        type: string;
        bookmarkId: string;
        url: string;
        localUpdated: number;
        remoteUpdated: number;
        userId: string;
        localTitle?: string;
        remoteTitle?: string;
      }>,
    };

    // Validate bookmarks array
    if (bookmarks !== undefined && !Array.isArray(bookmarks)) {
      return NextResponse.json({ error: 'Invalid bookmarks: must be an array' }, { status: 400 });
    }

    // Validate and sanitize bookmarks array items
    const validatedBookmarks = bookmarks && bookmarks.length > 0
      ? bookmarks.filter((b: unknown) => {
          if (!b || typeof b !== 'object') return false;
          const bookmark = b as Record<string, unknown>;
          if (!bookmark.url || typeof bookmark.url !== 'string') return false;
          if (!bookmark.updated_at || typeof bookmark.updated_at !== 'string') return false;
          // Validate timestamp format
          if (isNaN(Date.parse(bookmark.updated_at as string))) return false;
          return true;
        })
      : [];

    // Deduplicate bookmarks by URL to prevent upsert constraint errors
    const uniqueBookmarks = Array.from(
      new Map(validatedBookmarks.map((b: { url: string }) => [b.url, b])).values()
    );

    if (bookmarks && bookmarks.length > 0 && validatedBookmarks.length === 0) {
      return NextResponse.json({ error: 'No valid bookmarks provided' }, { status: 400 });
    }

    // Initialize bookmarksToUpsert outside conditional to avoid scope issues
    const bookmarksToUpsert: Array<{
      id?: string;
      user_id: string;
      url: string;
      title?: string;
      description?: string;
      domain?: string;
      favicon_url?: string;
      og_image?: string;
      og_title?: string;
      og_description?: string;
      source: 'extension' | 'web' | 'import' | 'api';
      created_at?: string;
      updated_at?: string;
    }> = [];

    if (validatedBookmarks.length > 0) {
      const { data: existingBookmarks, error: fetchError } = await supabase
        .from('bookmarks')
        .select('id, url, updated_at, title')
        .eq('user_id', user.id)
        .in('url', uniqueBookmarks.map((b: { url: string }) => b.url));

      if (fetchError) {
        console.error('Error fetching existing bookmarks:', fetchError);
        return NextResponse.json(
          { error: 'Failed to fetch existing bookmarks' },
          { status: 500 }
        );
      }

      const existingByUrl = new Map(
        (existingBookmarks || []).map((b) => [b.url, b])
      );

      for (const bookmark of uniqueBookmarks) {
        const existing = existingByUrl.get(bookmark.url);

        if (existing) {
          // Safely parse timestamps
          const localTime = Date.parse(bookmark.updated_at);
          const remoteTime = Date.parse(existing.updated_at || '');

          const localUpdated = !isNaN(localTime) ? localTime : 0;
          const remoteUpdated = !isNaN(remoteTime) ? remoteTime : 0;

          // Detect and record malformed remote timestamp as conflict
          if (isNaN(remoteTime)) {
            console.warn('[Sync] Malformed remote timestamp detected:', {
              bookmarkId: existing.id,
              url: bookmark.url,
              localUpdatedAt: bookmark.updated_at,
              remoteUpdatedAt: existing.updated_at,
            });
            // Record as conflict so client can surface it
            syncResults.conflicts.push({
              type: 'bookmark',
              bookmarkId: existing.id,
              url: bookmark.url,
              localUpdated,
              remoteUpdated: 0, // Invalid timestamp
              userId: user.id,
              localTitle: bookmark.title,
              remoteTitle: existing.title,
            });
            continue; // Skip this bookmark
          }

          if (localUpdated > remoteUpdated) {
            bookmarksToUpsert.push({
              id: existing.id,
              user_id: user.id,
              url: bookmark.url,
              title: bookmark.title,
              description: bookmark.description,
              domain: getHostnameFromUrl(bookmark.url, 'unknown'),
              favicon_url: bookmark.favicon_url,
              og_image: bookmark.og_image,
              og_title: bookmark.og_title,
              og_description: bookmark.og_description,
              source: 'extension',
            });
          } else if (remoteUpdated > localUpdated) {
            // Record conflict when remote is newer
            syncResults.conflicts.push({
              type: 'bookmark',
              bookmarkId: existing.id,
              url: bookmark.url,
              localUpdated,
              remoteUpdated,
              userId: user.id,
              localTitle: bookmark.title,
              remoteTitle: existing.title,
            });
          } else {
            // Timestamps are equal - record as conflict for client to resolve
            syncResults.conflicts.push({
              type: 'bookmark',
              bookmarkId: existing.id,
              url: bookmark.url,
              localUpdated,
              remoteUpdated,
              userId: user.id,
              localTitle: bookmark.title,
              remoteTitle: existing.title,
            });
          }
        } else {
          bookmarksToUpsert.push({
            user_id: user.id,
            url: bookmark.url,
            title: bookmark.title,
            description: bookmark.description,
            domain: getHostnameFromUrl(bookmark.url, 'unknown'),
            favicon_url: bookmark.favicon_url,
            og_image: bookmark.og_image,
            og_title: bookmark.og_title,
            og_description: bookmark.og_description,
            source: 'extension',
          });
        }
      }

      if (bookmarksToUpsert.length > 0) {
        // Validate that all items have user_id and url
        const validBookmarks = bookmarksToUpsert.filter(b => b.user_id && b.url);

        if (validBookmarks.length > 0) {
          const { data: upserted, error: upsertError } = await supabase
            .from('bookmarks')
            .upsert(validBookmarks, { onConflict: 'user_id,url' })
            .select();

          if (upsertError) {
            console.error('Error upserting bookmarks:', upsertError);
            return NextResponse.json(
              { error: 'Failed to upload bookmarks', details: upsertError.message },
              { status: 500 }
            );
          }
          syncResults.uploaded.bookmarks = upserted?.length || 0;
        }
      }
    }

    // Collect uploaded URLs to exclude from download
    const uploadedUrls = bookmarksToUpsert.map(b => b.url);

    const { data: remoteBookmarks, error: remoteError } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .gt('updated_at', validatedTimestamp)
      .is('deleted_at', null);

    if (remoteError) {
      console.error('Error fetching remote bookmarks:', remoteError);
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks' },
        { status: 500 }
      );
    }

    // Filter out uploaded URLs in JavaScript for safety
    syncResults.downloaded.bookmarks = (remoteBookmarks || []).filter(
      bookmark => !uploadedUrls.includes(bookmark.url)
    );

    const { data: remoteCollections, error: collectionsError } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', user.id)
      .gt('updated_at', validatedTimestamp)
      .is('deleted_at', null);

    if (collectionsError) {
      console.error('Error fetching remote collections:', collectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch collections' },
        { status: 500 }
      );
    }

    syncResults.downloaded.collections = remoteCollections || [];

    const { data: remoteTags, error: tagsError } = await supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .gt('updated_at', validatedTimestamp)
      .is('deleted_at', null);

    if (tagsError) {
      console.error('Error fetching remote tags:', tagsError);
      return NextResponse.json(
        { error: 'Failed to fetch tags' },
        { status: 500 }
      );
    }

    syncResults.downloaded.tags = remoteTags || [];

    return NextResponse.json({
      success: true,
      syncResults,
      serverTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Sync failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lastSyncTimestamp = request.nextUrl.searchParams.get('since');

    // Validate timestamp if provided
    let validatedTimestamp: string | null = null;
    if (lastSyncTimestamp) {
      const parsedTimestamp = Date.parse(lastSyncTimestamp);
      if (isNaN(parsedTimestamp)) {
        return NextResponse.json({ error: 'Invalid timestamp' }, { status: 400 });
      }
      validatedTimestamp = new Date(parsedTimestamp).toISOString();
    }

    let query = supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (validatedTimestamp) {
      query = query.gt('updated_at', validatedTimestamp);
    }

    const { data: bookmarks, error: bookmarksError } = await query;

    if (bookmarksError) {
      console.error('Error fetching bookmarks:', bookmarksError);
      return NextResponse.json(
        { error: 'Failed to fetch bookmarks' },
        { status: 500 }
      );
    }

    let collectionsQuery = supabase
      .from('collections')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (validatedTimestamp) {
      collectionsQuery = collectionsQuery.gt('updated_at', validatedTimestamp);
    }

    const { data: collections, error: collectionsError } = await collectionsQuery;

    if (collectionsError) {
      console.error('Error fetching collections:', collectionsError);
      return NextResponse.json(
        { error: 'Failed to fetch collections' },
        { status: 500 }
      );
    }

    let tagsQuery = supabase
      .from('tags')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (validatedTimestamp) {
      tagsQuery = tagsQuery.gt('updated_at', validatedTimestamp);
    }

    const { data: tags, error: tagsError } = await tagsQuery;

    if (tagsError) {
      console.error('Error fetching tags:', tagsError);
      return NextResponse.json(
        { error: 'Failed to fetch tags' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      bookmarks: bookmarks || [],
      collections: collections || [],
      tags: tags || [],
      serverTimestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Sync fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sync data' },
      { status: 500 }
    );
  }
}
