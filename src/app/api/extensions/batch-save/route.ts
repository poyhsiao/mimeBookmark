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

    const { tabs, collectionId, tags } = body;

    if (!tabs || !Array.isArray(tabs) || tabs.length === 0) {
      return NextResponse.json({ error: 'No tabs provided' }, { status: 400 });
    }

    // Validate tags if provided
    if (tags !== undefined && tags !== null && !Array.isArray(tags)) {
      return NextResponse.json({ error: 'Tags must be an array' }, { status: 400 });
    }

    // Validate each tag is a string if tags array is provided
    if (Array.isArray(tags) && tags.some((tag) => typeof tag !== 'string')) {
      return NextResponse.json({ error: 'All tags must be strings' }, { status: 400 });
    }

    // Validate collection ownership BEFORE processing bookmarks
    if (collectionId) {
      const { data: collection, error: collectionFetchError } = await supabase
        .from('collections')
        .select('id')
        .eq('id', collectionId)
        .eq('user_id', user.id)
        .single();

      if (collectionFetchError || !collection) {
        return NextResponse.json(
          { error: 'Collection not found or access denied' },
          { status: 403 }
        );
      }
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

    const bookmarksToInsert: Array<{
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
    }> = [];

    // Collect URLs from validTabs
    const urls = validTabs.map((tab: { url: string }) => tab.url);

    // Query existing bookmarks for these URLs to deduplicate
    const { data: existingBookmarks, error: existingError } = await supabase
      .from('bookmarks')
      .select('url')
      .eq('user_id', user.id)
      .in('url', urls)
      .is('deleted_at', null);

    if (existingError) {
      console.error('Error fetching existing bookmarks for deduplication:', existingError);
      return NextResponse.json(
        { error: 'Failed to check for existing bookmarks' },
        { status: 500 }
      );
    }

    const existingUrls = new Set((existingBookmarks || []).map(b => b.url));

    let skippedDuplicates = 0;
    for (const tab of validTabs) {
      const url = tab.url;

      // Skip if already exists
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

    // Only insert if there are new bookmarks
    if (bookmarksToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        saved: 0,
        skipped: skippedDuplicates,
        bookmarks: [],
        warnings: ['All bookmarks already exist'],
      });
    }

    const { data: insertedBookmarks, error: insertError } = await supabase
      .from('bookmarks')
      .insert(bookmarksToInsert)
      .select();

    if (insertError) {
      console.error('Error inserting bookmarks:', insertError);
      return NextResponse.json(
        { error: 'Failed to save bookmarks' },
        { status: 500 }
      );
    }

    let collectionAssignmentError: Error | null = null;
    if (collectionId && insertedBookmarks && insertedBookmarks.length > 0) {
      // Collection ownership already verified above
      const { error: assignmentError } = await supabase
        .from('collection_bookmarks')
        .upsert(
          insertedBookmarks.map((bookmark) => ({
            collection_id: collectionId,
            bookmark_id: bookmark.id,
          })),
          { onConflict: 'collection_id, bookmark_id' }
        );

      if (assignmentError) {
        collectionAssignmentError = assignmentError;
        console.error('Error assigning to collection:', assignmentError);
      }
    }

    let tagAssignmentError: Error | null = null;
    if (tags && tags.length > 0 && insertedBookmarks && insertedBookmarks.length > 0) {
      const { data: existingTags } = await supabase
        .from('tags')
        .select('id, name')
        .eq('user_id', user.id)
        .in('name', tags);

      const existingTagMap = new Map(
        (existingTags || []).map((t) => [t.name, t.id])
      );

      const tagsToCreate: Array<{ user_id: string; name: string; color: string }> = [];
      const tagLinks: Array<{ bookmark_id: string; tag_id: string }> = [];

      for (const tagName of tags) {
        if (existingTagMap.has(tagName)) {
          const tagId = existingTagMap.get(tagName)!;
          for (const bookmark of insertedBookmarks) {
            tagLinks.push({ bookmark_id: bookmark.id, tag_id: tagId });
          }
        } else {
          tagsToCreate.push({
            user_id: user.id,
            name: tagName,
            color: '#3b82f6',
          });
        }
      }

      const tagAssignmentErrors: Error[] = [];

      if (tagsToCreate.length > 0) {
        const { data: newTags, error: createError } = await supabase
          .from('tags')
          .insert(tagsToCreate)
          .select();

        if (createError) {
          tagAssignmentErrors.push(new Error(`Failed to create tags: ${createError.message}`));
          console.error('Error creating tags:', createError);
        } else if (newTags) {
          for (const newTag of newTags) {
            for (const bookmark of insertedBookmarks) {
              tagLinks.push({ bookmark_id: bookmark.id, tag_id: newTag.id });
            }
          }
        } else {
          tagAssignmentErrors.push(new Error('Failed to create tags: No tags returned'));
        }
      }

      if (tagLinks.length > 0) {
        const { error: tagError } = await supabase
          .from('bookmark_tags')
          .upsert(tagLinks, { onConflict: 'bookmark_id, tag_id' });

        if (tagError) {
          tagAssignmentErrors.push(tagError);
          console.error('Error assigning tags:', tagError);
        }
      }

      if (tagAssignmentErrors.length > 0) {
        tagAssignmentError = tagAssignmentErrors.length === 1
          ? tagAssignmentErrors[0]
          : new Error(`Multiple tag errors: ${tagAssignmentErrors.map(e => e.message).join('; ')}`);
      }
    }

    return NextResponse.json({
      success: true,
      saved: insertedBookmarks?.length || 0,
      skipped: skippedDuplicates,
      bookmarks: insertedBookmarks,
      warnings: [
        collectionAssignmentError && 'Failed to assign some bookmarks to collection',
        tagAssignmentError && tagAssignmentError.message,
      ].filter(Boolean),
    });
  } catch (error) {
    console.error('Batch save tabs error:', error);
    return NextResponse.json(
      { error: 'Failed to save tabs' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: bookmark, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .eq('url', url)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      console.error('Error checking bookmark:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to check bookmark' },
        { status: 500 }
      );
    }

    if (!bookmark) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
      bookmark,
    });
  } catch (error) {
    console.error('Check bookmark error:', error);
    return NextResponse.json(
      { error: 'Failed to check bookmark' },
      { status: 500 }
    );
  }
}
