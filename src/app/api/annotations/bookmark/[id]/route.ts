import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/annotations/bookmark/:id - Get all annotations for a specific bookmark
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: bookmarkId } = await params;

    // Verify the bookmark belongs to the user
    const { data: bookmark, error: bookmarkError } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('id', bookmarkId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (bookmarkError) {
      if (bookmarkError.code === 'PGRST116' || !bookmark) {
        return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
      }
      console.error('Get bookmark annotations - database error:', bookmarkError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    if (!bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    // Get all annotations for this bookmark
    const { data: annotations, error } = await supabase
      .from('annotations')
      .select('*')
      .eq('bookmark_id', bookmarkId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get bookmark annotations - database error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ annotations: annotations || [] });
  } catch (error) {
    console.error('Get bookmark annotations error:', error);
    return NextResponse.json({ error: 'Failed to get bookmark annotations' }, { status: 500 });
  }
}
