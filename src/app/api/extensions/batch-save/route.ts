import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getHostnameFromUrl } from '@/lib/utils/sql-escape';
import { rateLimiters, type RateLimitResult } from '@/lib/rate-limiter';

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
      const body = await request.json();
      collectionId = body.collectionId;
      tags = body.tags;
      tabs = body.tabs;
    } catch (error) {
      if (error instanceof SyntaxError) {
        return NextResponse.json(
          { error: 'Malformed JSON in request body' },
          { status: 400 }
        );
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

    // Validate tabs first
    const validTabs = tabs.filter((tab: { url: string; title?: string; favicon?: string }) => {
      if (!tab.url || typeof tab.url !== 'string') return false;
      try {
        new URL(tab.url);
        return true;
      } catch {
        return false;
      }
    });

    // Check if there are any valid tabs
    if (validTabs.length === 0) {
      return NextResponse.json({ error: 'No valid tabs provided' }, { status: 400 });
    }

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
    const urls = validTabs.map((tab: { url: string }) => tab.url);

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

    for (const tab of validTabs) {
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

    // Check quota after deduplication
    if (bookmarksToInsert.length > remainingSlots) {
      return NextResponse.json({
        error: 'Not enough storage',
        requested: bookmarksToInsert.length,
        remaining: remainingSlots,
      }, { status: 403 });
    }

    // Capture timestamp BEFORE upsert for querying remote changes
    // This allows us to detect concurrent changes from other clients
    const validatedTimestamp = new Date().toISOString();

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

      // Handle tags if provided
      if (tags && tags.length > 0 && upserted.length > 0) {
        // Create or get existing tags
        const tagNameToId: Record<string, string> = {};
        const tagNames = tags
          .filter(t => typeof t === 'string' && t.trim().length > 0)
          .map(t => t.toLowerCase());

        if (tagNames.length > 0) {
          // Batch query: fetch all existing tags at once
          const { data: existingTags } = await supabase
            .from('tags')
            .select('id, name')
            .eq('user_id', user.id)
            .in('name', tagNames)
            .is('deleted_at', null);

          // Populate map with existing tags
          if (existingTags) {
            for (const tag of existingTags) {
              tagNameToId[tag.name.toLowerCase()] = tag.id;
            }
          }

          // Find tags that need to be created, deduplicating by lowercase name
          // Build a map from lowercase name to canonical original string
          const lowerToCanonical: Record<string, string> = {};
          for (const t of tags) {
            if (typeof t !== 'string' || !t.trim()) continue;
            const lowerName = t.toLowerCase();
            // Skip if already in existing tags
            if (tagNameToId[lowerName]) continue;
            // Only store first occurrence for each lowercase variant
            if (!lowerToCanonical[lowerName]) {
              lowerToCanonical[lowerName] = t;
            }
          }

          const tagsToCreate = Object.values(lowerToCanonical);

          // Batch insert new tags with upsert to handle race conditions
          // ignoreDuplicates: true ensures we don't update existing tags' custom colors
          if (tagsToCreate.length > 0) {
            const { data: insertedTags, error: insertError } = await supabase
              .from('tags')
              .insert(
                tagsToCreate.map(tag => ({
                  user_id: user.id,
                  name: tag,
                  color: '#6B7280',
                }))
              )
              .select('id, name');

            if (insertError) {
              console.error('Failed to create tags:', insertError);
              // Fallback: re-query all tag names we tried to insert
              const { data: fallbackTags } = await supabase
                .from('tags')
                .select('id, name')
                .eq('user_id', user.id)
                .in('name', tagNames)
                .is('deleted_at', null);

              if (fallbackTags) {
                for (const tag of fallbackTags) {
                  tagNameToId[tag.name.toLowerCase()] = tag.id;
                }
              }
            } else if (insertedTags) {
              for (const tag of insertedTags) {
                tagNameToId[tag.name.toLowerCase()] = tag.id;
              }
            }
          }

          // Link tags to all inserted bookmarks
          const tagLinks: { bookmark_id: string; tag_id: string }[] = [];
          for (const bookmark of upserted) {
            for (const tagName of tags) {
              if (typeof tagName !== 'string' || !tagName.trim()) continue;
              const tagId = tagNameToId[tagName.toLowerCase()];
              if (tagId) {
                tagLinks.push({
                  bookmark_id: bookmark.id,
                  tag_id: tagId,
                });
              }
            }
          }

          // Batch insert tag links
          if (tagLinks.length > 0) {
            const { error: tagLinksError } = await supabase
              .from('bookmark_tags')
              .upsert(tagLinks);

            if (tagLinksError) {
              console.error('Failed to link tags to bookmarks:', tagLinksError);
            } else {
              // Count unique tags, not tag-link associations
              const uniqueTagIds = new Set(tagLinks.map(link => link.tag_id));
              syncResults.uploaded.tags = uniqueTagIds.size;
            }
          }
        }
      }
    }

    // Collect uploaded URLs to exclude from download
    const uploadedUrls = bookmarksToInsert.map(b => b.url);

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
