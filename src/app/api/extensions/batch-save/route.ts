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
        response.headers.set('Retry-After', rateLimitCheck.retryAfter.toString());
      }

      return response;
    }

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

    if (!collectionId) {
      return NextResponse.json({ error: 'Missing collectionId' }, { status: 400 });
    }

    if (!Array.isArray(tabs)) {
      return NextResponse.json({ error: 'tabs must be an array' }, { status: 400 });
    }

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

    for (const bookmark of bookmarksToInsert) {
      if (existingUrls.has(bookmark.url)) {
        skippedDuplicates++;
        continue;
      }
    }

    const uniqueTabs = Array.from(new Map(validTabs.map(tab => [tab.url, tab])).values());

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

    if (bookmarksToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        saved: 0,
        skipped: skippedDuplicates,
        bookmarks: [],
        warnings: ['All bookmarks already exist'],
      });
    }

    const validatedTimestamp = new Date().toISOString();

    const syncResults: SyncResults = {
      uploaded: { bookmarks: 0, collections: 0, tags: 0 },
      downloaded: {
        bookmarks: [] as Array<Record<string, unknown>>,
        collections: [] as Array<Record<string, unknown>>,
        tags: [] as Array<Record<string, unknown>>
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

      upserted = upsertedData || [];
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
