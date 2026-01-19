import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/bookmarks/batch-delete - Soft delete multiple bookmarks
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { bookmark_ids } = body;

    if (!bookmark_ids || !Array.isArray(bookmark_ids) || bookmark_ids.length === 0) {
      return NextResponse.json({ error: 'bookmark_ids array is required' }, { status: 400 });
    }

    // Verify all bookmarks belong to the user and are not already deleted
    const { data: bookmarks, error: selectError } = await supabase
      .from('bookmarks')
      .select('id')
      .in('id', bookmark_ids)
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (selectError) {
      return NextResponse.json({ error: selectError.message }, { status: 500 });
    }

    const validIds = bookmarks?.map(b => b.id) || [];
    
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid bookmarks found' }, { status: 404 });
    }

    // Soft delete all valid bookmarks
    const { error: updateError } = await supabase
      .from('bookmarks')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', validIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${validIds.length} bookmark(s) deleted`,
      deleted_count: validIds.length,
      deleted_ids: validIds
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // Log and return 500 for unexpected errors instead of masking them as 400
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Unexpected error in batch-delete:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
