import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function getCollection(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from('collections')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  return data;
}

// GET /api/collections/[id] - Get a single collection with bookmarks
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const collection = await getCollection(supabase, id, user.id);

  if (!collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  // Get bookmarks in this collection
  const { data: bookmarks } = await supabase
    .from('collection_bookmarks')
    .select(`
      bookmark_id,
      sort_order,
      bookmarks:bookmarks!inner(
        id,
        url,
        title,
        description,
        domain,
        favicon_url,
        is_favorite,
        created_at
      )
    `)
    .eq('collection_id', id)
    .order('sort_order', { ascending: true });

  return NextResponse.json({
    collection,
    bookmarks: bookmarks?.map(b => b.bookmarks).filter(Boolean) || [],
  });
}

// PATCH /api/collections/[id] - Update a collection
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const collection = await getCollection(supabase, id, user.id);

  if (!collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { name, description, color, icon, is_favorite, is_public } = body;

    // Build update payload, filtering out undefined values
    const updatePayload: Record<string, unknown> = {};
    if (name !== undefined) updatePayload.name = name;
    if (description !== undefined) updatePayload.description = description;
    if (color !== undefined) updatePayload.color = color;
    if (icon !== undefined) updatePayload.icon = icon;
    if (is_favorite !== undefined) updatePayload.is_favorite = is_favorite;
    if (is_public !== undefined) updatePayload.is_public = is_public;

    const { data: updatedCollection, error } = await supabase
      .from('collections')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ collection: updatedCollection });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE /api/collections/[id] - Delete a collection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const collection = await getCollection(supabase, id, user.id);

  if (!collection) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }

  // Soft delete
  const { error } = await supabase
    .from('collections')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
