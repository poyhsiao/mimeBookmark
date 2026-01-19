import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to get a deleted bookmark
async function getDeletedBookmark(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

// POST /api/bookmarks/[id]/restore - Restore a soft-deleted bookmark
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const bookmark = await getDeletedBookmark(supabase, id, user.id);

    if (!bookmark) {
      return NextResponse.json({ error: 'Deleted bookmark not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('bookmarks')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark restored successfully',
      bookmark: { ...bookmark, deleted_at: null }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
