import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { collectionIds } = body;

    if (!Array.isArray(collectionIds) || collectionIds.length === 0) {
      return NextResponse.json({ error: 'collectionIds must be a non-empty array' }, { status: 400 });
    }

    // Deduplicate collection IDs
    const uniqueIds = Array.from(new Set(collectionIds));

    // Validate ownership before upserting
    const { data: ownedCollections, error: validationError } = await supabase
      .from('collections')
      .select('id')
      .in('id', uniqueIds)
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (validationError) {
      return NextResponse.json({ error: `Database error: ${validationError.message}` }, { status: 500 });
    }

    if (!ownedCollections || ownedCollections.length !== uniqueIds.length) {
      return NextResponse.json({ error: 'Invalid collection IDs' }, { status: 403 });
    }

    const updates = uniqueIds.map((id: string, index: number) => ({
      id,
      sort_order: index,
    }));

    const { error } = await supabase
      .from('collections')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
