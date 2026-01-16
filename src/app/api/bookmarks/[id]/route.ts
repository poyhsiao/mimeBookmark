import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to check ownership
async function getBookmark(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();

  if (error) {
    throw new Error(`Database error: ${error.message}`);
  }

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

  try {
    const bookmark = await getBookmark(supabase, id, user.id);

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
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
  }
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

  try {
    const bookmark = await getBookmark(supabase, id, user.id);

    const body = await request.json();
    const { tags, collection_id, title, url, description, is_favorite, is_archived, is_read_later, user_notes, user_rating, metadata } = body;

    // Whitelist allowed updatable fields
    const updateData: Record<string, any> = {};
    if (title !== undefined) updateData.title = title;
    if (url !== undefined) updateData.url = url;
    if (description !== undefined) updateData.description = description;
    if (is_favorite !== undefined) updateData.is_favorite = is_favorite;
    if (is_archived !== undefined) updateData.is_archived = is_archived;
    if (is_read_later !== undefined) updateData.is_read_later = is_read_later;
    if (user_notes !== undefined) updateData.user_notes = user_notes;
    if (user_rating !== undefined) updateData.user_rating = user_rating;
    if (metadata !== undefined) updateData.metadata = metadata;

    const { data: updatedBookmark, error } = await supabase
      .from('bookmarks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Handle tags update
    if (tags !== undefined) {
      const { error: deleteError } = await supabase.from('bookmark_tags').delete().eq('bookmark_id', id);

      if (deleteError) {
        return NextResponse.json({ error: `Failed to update tags: ${deleteError.message}` }, { status: 500 });
      }

      if (tags.length > 0) {
        const tagEntries = tags.map((tagId: string) => ({
          bookmark_id: id,
          tag_id: tagId,
        }));

        const { error: insertError } = await supabase.from('bookmark_tags').insert(tagEntries);

        if (insertError) {
          return NextResponse.json({ error: `Failed to insert tags: ${insertError.message}` }, { status: 500 });
        }
      }
    }

    // Handle collection update
    if (collection_id !== undefined) {
      const { error: deleteError } = await supabase.from('collection_bookmarks').delete().eq('bookmark_id', id);

      if (deleteError) {
        return NextResponse.json({ error: `Failed to update collection: ${deleteError.message}` }, { status: 500 });
      }

      if (collection_id) {
        const { error: insertError } = await supabase.from('collection_bookmarks').insert({
          collection_id,
          bookmark_id: id,
        });

        if (insertError) {
          return NextResponse.json({ error: `Failed to insert collection: ${insertError.message}` }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ bookmark: updatedBookmark });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
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

  try {
    await getBookmark(supabase, id, user.id);

    const { error } = await supabase
      .from('bookmarks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
  }
}
