import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const MAX_LIMIT = 100;

// GET /api/collections - List collections with pagination
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'newest';

  // Validate and sanitize pagination params with safe defaults
  const rawPage = searchParams.get('page');
  const rawLimit = searchParams.get('limit');
  const page = Number.isNaN(parseInt(rawPage || '1', 10)) ? 1 : Math.max(1, parseInt(rawPage || '1', 10));
  const limit = Number.isNaN(parseInt(rawLimit || '20', 10))
    ? 20
    : Math.min(MAX_LIMIT, Math.max(1, parseInt(rawLimit || '20', 10)));

  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('collections')
    .select(`
      *,
      bookmarks_count
    `, { count: 'exact' })
    .eq('user_id', user.id)
    .is('deleted_at', null);

  // Search - escape wildcards to prevent SQL injection
  if (search) {
    const searchEscaped = search
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    query = query.ilike('name', `%${searchEscaped}%`);
  }

  // Sorting
  switch (sort) {
    case 'name':
      query = query.order('name', { ascending: true });
      break;
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    default: // newest
      query = query.order('created_at', { ascending: false });
  }

  const { data: collections, error, count } = await query
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    collections,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}

// POST /api/collections - Create a new collection
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, description, color, icon, parent_id } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Collection name is required' }, { status: 400 });
    }

    const { data: collection, error } = await supabase
      .from('collections')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim(),
        color: color || '#3B82F6',
        icon: icon || 'folder',
        parent_id: parent_id || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ collection }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
