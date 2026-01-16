import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to check ownership
async function getBookmark(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  return data;
}

// GET /api/bookmarks/[id] - Get a single bookmark
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
  const bookmark = await getBookmark(supabase, id, user.id);

  if (!bookmark) {
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
  }

  // Get tags
  const { data: tags } = await supabase
    .from('bookmark_tags')
    .select(`
      tags:tags!inner(
        id,
        name,
        color
      )
    `)
    .eq('bookmark_id', id);

  // Get collections
  const { data: collections } = await supabase
    .from('collection_bookmarks')
    .select(`
      collections:collections!inner(
        id,
        name,
        color
      )
    `)
    .eq('bookmark_id', id);

  return NextResponse.json({
    bookmark,
    tags: tags?.map(t => t.tags).filter(Boolean) || [],
    collections: collections?.map(c => c.collections).filter(Boolean) || [],
  });
}

// PATCH /api/bookmarks/[id] - Update a bookmark
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
  const bookmark = await getBookmark(supabase, id, user.id);

  if (!bookmark) {
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { tags, collection_id, ...updateData } = body;

    const { data: updatedBookmark, error } = await supabase
      .from('bookmarks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (tags !== undefined) {
      await supabase.from('bookmark_tags').delete().eq('bookmark_id', id);

      if (tags.length > 0) {
        const tagEntries = tags.map((tagId: string) => ({
          bookmark_id: id,
          tag_id: tagId,
        }));

        await supabase.from('bookmark_tags').insert(tagEntries);
      }
    }

    if (collection_id !== undefined) {
      await supabase.from('collection_bookmarks').delete().eq('bookmark_id', id);

      if (collection_id) {
        await supabase.from('collection_bookmarks').insert({
          collection_id,
          bookmark_id: id,
        });
      }
    }

    return NextResponse.json({ bookmark: updatedBookmark });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// DELETE /api/bookmarks/[id] - Delete a bookmark
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
  const bookmark = await getBookmark(supabase, id, user.id);

  if (!bookmark) {
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('bookmarks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
