import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimiters, type RateLimitResult } from '@/lib/rate-limiter';
import { parseBatchSaveBody } from './parse-body';
import { buildBookmarksToInsert } from './bookmarks';
import { syncTagsForBookmarks } from './tags';
import { buildSyncResultsSince } from './sync-results';
import type { BookmarkToInsert, SyncResults, ValidationError } from './types';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit check - moved immediately after authentication
    const rateLimitCheck = rateLimiters.batchSave.check(user.id, 'extensions:batchSave') as RateLimitResult;
    if (!rateLimitCheck.allowed) {
      const response = NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Please try again after ${rateLimitCheck.retryAfter ?? 0} seconds`,
        },
        { status: 429 },
      );

      if (rateLimitCheck.retryAfter) {
        // retryAfter is already in seconds from rate limiter
        response.headers.set('Retry-After', rateLimitCheck.retryAfter.toString());
      }

      return response;
    }

    // Parse and validate request body with error handling
    let collectionId: string;
    let tags: string[] | undefined;
    let tabs: Array<{ url: string; title?: string; favicon?: string }>;

    try {
      ({ collectionId, tags, tabs } = await parseBatchSaveBody(request));
    } catch (err: any) {
      if (err.status) {
        return NextResponse.json(
          { error: err.message },
          { status: err.status }
        );
      }
      throw err;
    }
      // Re-throw other errors to be caught by the outer try-catch
      throw error;
    }

    // Fixed validation error messages
    if (!collectionId && !Array.isArray(tabs)) {
      return NextResponse.json(
        { error: 'Missing collectionId and tabs must be an array' },
        { status: 400 }
      );
    }

    if (!collectionId) {
      return NextResponse.json({ error: 'Missing collectionId' }, { status: 400 });
    }

    if (!Array.isArray(tabs)) {
      return NextResponse.json({ error: 'tabs must be an array' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('bookmarks_count, bookmarks_limit')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    const limit = Number(profile.bookmarks_limit ?? 0);
    const count = Number(profile.bookmarks_count ?? 0);
    const remainingSlots = Math.max(0, limit - count);

    let bookmarksToInsert: BookmarkToInsert[];
    let skippedDuplicates = 0;

    try {
      ({ bookmarksToInsert, validTabs } = buildBookmarksToInsert(tabs, user.id, collectionId, remainingSlots));
    } catch (err: any) {
      if (err.status === 400 || err.status === 403) {
        return NextResponse.json(
          err.meta ? { error: err.message, ...err.meta } : { error: err.message },
          { status: err.status }
        );
      }
      throw err;
    }

    const urls = bookmarksToInsert.map(b => b.url);

    // Query existing bookmarks for these URLs to deduplicate
    const { data: existingBookmarks, error: existingError } = await supabase
      .from('bookmarks')
      .select('url')
      .eq('user_id', user.id)
      .in('url', urls)
      .is('deleted_at', null);

    if (existingError) {
      console.error('Error fetching existing bookmarks:', existingError);
      return NextResponse.json(
        { error: 'Failed to check for existing bookmarks' },
        { status: 500 }
      );
    }

    const existingUrls = new Set((existingBookmarks || []).map(b => b.url));

    const urlsToInsert = bookmarksToInsert.map(b => b.url);
    let skippedDuplicates = 0;

    for (const bookmark of bookmarksToInsert) {
      if (existingUrls.has(bookmark.url)) {
        skippedDuplicates++;
        continue;
      }
    }
    });

    // Check if there are any valid tabs
    if (validTabs.length === 0) {
      return NextResponse.json({ error: 'No valid tabs provided' }, { status: 400 });
    }

    // Deduplicate URLs within the batch to prevent upsert conflicts
    const uniqueTabs = Array.from(new Map(validTabs.map(tab => [tab.url, tab])).values());

    // Initialize sync results
    const syncResults = {
      uploaded: { bookmarks: 0, collections: 0, tags: 0 },
      downloaded: {
        bookmarks: [] as Array<Record<string, unknown>>,
        collections: [] as Array<Record<string, unknown>>,
        tags: [] as Array<Record<string, unknown>>
      },
    };

    type BookmarkToInsert = {
      user_id: string;
      url: string;
      title: string;
      description?: string;
      domain: string;
      favicon_url?: string;
      og_image?: string;
      og_title?: string;
      og_description?: string;
      source: 'extension';
      collection_id?: string;
    };
    const bookmarksToInsert: BookmarkToInsert[] = [];

    // Collect URLs from uniqueTabs only
    const urls = uniqueTabs.map((tab: { url: string }) => tab.url);

    // Query existing bookmarks for these URLs to deduplicate
    const { data: existingBookmarks, error: existingError } = await supabase
      .from('bookmarks')
      .select('url')
      .eq('user_id', user.id)
      .in('url', urls)
      .is('deleted_at', null);

    if (existingError) {
      console.error('Error fetching existing bookmarks:', existingError);
      return NextResponse.json(
        { error: 'Failed to check for existing bookmarks' },
        { status: 500 }
      );
    }

    const existingUrls = new Set((existingBookmarks || []).map(b => b.url));
    let skippedDuplicates = 0;

    // Hoisted upserted variable
    // Type includes id and other DB fields returned by .select()
    type UpsertedBookmark = BookmarkToInsert & {
      id: string;
      created_at: string;
      updated_at: string;
      is_favorite?: boolean;
      is_archived?: boolean;
      is_read_later?: boolean;
      clicks?: number;
      last_opened_at?: string | null;
      user_notes?: string | null;
      user_rating?: number | null;
      deleted_at?: string | null;
    };
    let upserted: UpsertedBookmark[] = [];

    for (const tab of uniqueTabs) {
      const url = tab.url;

      if (existingUrls.has(url)) {
        skippedDuplicates++;
        continue;
      }

      const domain = getHostnameFromUrl(url, 'unknown');
      bookmarksToInsert.push({
        user_id: user.id,
        url,
        title: tab.title || url,
        domain,
        favicon_url: tab.favicon,
        source: 'extension',
        collection_id: collectionId,
      });
    }

    if (bookmarksToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        saved: 0,
        skipped: skippedDuplicates,
        bookmarks: [],
        warnings: ['All bookmarks already exist'],
      });
    }

    // Capture timestamp BEFORE upsert for querying remote changes
    // This allows us to detect concurrent changes from other clients
    const validatedTimestamp = new Date().toISOString();

    const syncResults: SyncResults = {
      uploaded: { bookmarks: 0, collections: 0, tags: 0 },
      downloaded: {
        bookmarks: [],
        collections: [],
        tags: [],
      },
    };

    if (bookmarksToInsert.length > 0) {
      const validBookmarks = bookmarksToInsert.filter(b => b.user_id && b.url);

      const { data: upsertedData, error: upsertError } = await supabase
        .from('bookmarks')
        .upsert(validBookmarks, { onConflict: 'user_id,url' })
        .select();

      if (upsertError) {
        console.error('Error upserting bookmarks:', upsertError);
        return NextResponse.json(
          { error: 'Failed to save bookmarks', details: upsertError.message },
          { status: 500 }
        );
      }
      const upserted = upsertedData || [];
      syncResults.uploaded.bookmarks = upserted.length;

      if (tags && upserted.length > 0) {
        syncResults.uploaded.tags = await syncTagsForBookmarks(supabase, user.id, tags, upserted);
      }
    }

    const uploadedUrls = bookmarksToInsert.map(b => b.url);

    try {
      syncResults.downloaded = await buildSyncResultsSince(
        supabase,
        user.id,
        validatedTimestamp,
        uploadedUrls
      );
    } catch (err: any) {
      if (err.status === 500) {
        console.error(`Error fetching remote ${err.context}:`, err);
        return NextResponse.json(
          { error: `Failed to fetch ${err.context}` },
          { status: 500 }
        );
      }
      throw err;
    }

    return NextResponse.json({
      success: true,
      saved: bookmarksToInsert.length,
      skipped: skippedDuplicates,
      bookmarks: upserted,
      syncResults,
    });
  } catch (error) {
    console.error('Batch save tabs error:', error);
    return NextResponse.json(
      { error: 'Failed to save tabs' },
      { status: 500 }
    );
  }
}
