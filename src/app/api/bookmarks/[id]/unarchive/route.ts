import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to get an archived bookmark
async function getArchivedBookmark(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_archived', true)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    throw new Error(`Database error: ${error.message}`);
  }

  return data;
}

// POST /api/bookmarks/[id]/unarchive - Unarchive a bookmark
export async function POST(
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
    const bookmark = await getArchivedBookmark(supabase, id, user.id);

    if (!bookmark) {
      return NextResponse.json({ error: 'Archived bookmark not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('bookmarks')
      .update({ is_archived: false })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark unarchived successfully',
      bookmark: { ...bookmark, is_archived: false }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Return 500 for unexpected errors instead of masking them as 404
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
