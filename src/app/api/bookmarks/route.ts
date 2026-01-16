import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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

  // Search
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,url.ilike.%${search}%,user_notes.ilike.%${search}%`);
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
    const { url, title, description, collection_id, tags, ...rest } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Extract domain from URL
    const domain = url.split('://')[1]?.split('/')[0] || url;

    // Create bookmark
    const { data: bookmark, error } = await supabase
      .from('bookmarks')
      .insert({
        user_id: user.id,
        url,
        title,
        description,
        domain,
        ...rest,
      })
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
