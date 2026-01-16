import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper function to safely extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    // If URL parsing fails, try prepending protocol
    try {
      const urlWithProtocol = url.startsWith('//') ? `https:${url}` : `https://${url}`;
      const urlObj = new URL(urlWithProtocol);
      return urlObj.hostname;
    } catch {
      // Fallback: extract domain-like string from input
      const match = url.match(/^(?:https?:\/\/)?(?:www\.)?([^\/\s:]+)/i);
      return match ? match[1] : 'unknown';
    }
  }
}

// GET /api/bookmarks - List bookmarks with pagination and filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const collection_id = searchParams.get('collection_id');
  const is_favorite = searchParams.get('is_favorite');
  const is_archived = searchParams.get('is_archived');
  const sort = searchParams.get('sort') || 'newest';

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('bookmarks')
    .select(`
      *,
      tags:bookmark_tags(tags!inner(
        id,
        name,
        color
      )),
      collections:collection_bookmarks(collections!inner(
        id,
        name,
        color
      ))
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  // Filters
  if (collection_id) {
    query = query.eq('collection_bookmarks.collection_id', collection_id);
  }

  if (is_favorite === 'true') {
    query = query.eq('is_favorite', true);
  }

  if (is_archived === 'true') {
    query = query.eq('is_archived', true);
  } else {
    query = query.eq('is_archived', false);
  }

  // Search using textSearch for safety (prevents SQL injection)
  if (search) {
    // Use Supabase's safe search with escaped search term
    const searchTerm = search.replace(/[%_]/g, '\\$&'); // Escape wildcards
    query = query.or(
      `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,url.ilike.%${searchTerm}%,user_notes.ilike.%${searchTerm}%`
    );
  }

  // Sorting
  switch (sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'name':
      query = query.order('title', { ascending: true, nullsFirst: false });
      break;
    case 'domain':
      query = query.order('domain', { ascending: true });
      break;
    case 'clicks':
      query = query.order('clicks', { ascending: false });
      break;
    default: // newest
      query = query.order('created_at', { ascending: false });
  }

  const { data: bookmarks, error, count } = await query
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    bookmarks,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

// POST /api/bookmarks - Create a new bookmark
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      url,
      title,
      description,
      collection_id,
      tags,
      is_favorite,
      is_archived,
      is_read_later,
      user_notes,
      user_rating,
      metadata,
      favicon_url,
      og_image,
      og_title,
      og_description
    } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract domain from URL safely
    const domain = extractDomain(url);

    // Build insert payload with only whitelisted fields
    const insertData: any = {
      user_id: user.id,
      url,
      domain,
    };

    // Only include allowed fields if provided
    if (title !== undefined) insertData.title = title;
    if (description !== undefined) insertData.description = description;
    if (is_favorite !== undefined) insertData.is_favorite = is_favorite;
    if (is_archived !== undefined) insertData.is_archived = is_archived;
    if (is_read_later !== undefined) insertData.is_read_later = is_read_later;
    if (user_notes !== undefined) insertData.user_notes = user_notes;
    if (user_rating !== undefined) insertData.user_rating = user_rating;
    if (metadata !== undefined) insertData.metadata = metadata;
    if (favicon_url !== undefined) insertData.favicon_url = favicon_url;
    if (og_image !== undefined) insertData.og_image = og_image;
    if (og_title !== undefined) insertData.og_title = og_title;
    if (og_description !== undefined) insertData.og_description = og_description;

    // Create bookmark
    const { data: bookmark, error } = await supabase
      .from('bookmarks')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add to collection if specified
    if (collection_id) {
      const { error: collectionError } = await supabase
        .from('collection_bookmarks')
        .insert({
          collection_id,
          bookmark_id: bookmark.id,
        });

      if (collectionError) {
        return NextResponse.json({ error: collectionError.message }, { status: 500 });
      }
    }

    // Add tags if specified
    if (tags && tags.length > 0) {
      const tagEntries = tags.map((tagId: string) => ({
        bookmark_id: bookmark.id,
        tag_id: tagId,
      }));

      const { error: tagsError } = await supabase
        .from('bookmark_tags')
        .insert(tagEntries);

      if (tagsError) {
        return NextResponse.json({ error: tagsError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ bookmark }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
