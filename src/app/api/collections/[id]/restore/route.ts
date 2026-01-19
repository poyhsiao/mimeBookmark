import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to get a deleted collection
async function getDeletedCollection(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data, error } = await supabase
    .from('collections')
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

// POST /api/collections/[id]/restore - Restore a soft-deleted collection
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
    const collection = await getDeletedCollection(supabase, id, user.id);

    if (!collection) {
      return NextResponse.json({ error: 'Deleted collection not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('collections')
      .update({ deleted_at: null })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Collection restored successfully',
      collection: { ...collection, deleted_at: null }
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Database error')) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
