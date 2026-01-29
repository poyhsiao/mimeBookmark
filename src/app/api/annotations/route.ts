import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { checkAnnotationLimit } from '@/lib/subscription';

// GET /api/annotations - List annotations with pagination and filters
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookmark_id = searchParams.get('bookmark_id');
    const content_type = searchParams.get('content_type');

    // Validate and sanitize pagination inputs
    const rawPage = parseInt(searchParams.get('page') || '1');
    const rawLimit = parseInt(searchParams.get('limit') || '20');

    // Guard against NaN, non-integers, zero or negative values
    const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('annotations')
      .select(`
        *,
        bookmarks:bookmarks!inner(
          id,
          title,
          url,
          domain
        )
      `, { count: 'exact' })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (bookmark_id) {
      query = query.eq('bookmark_id', bookmark_id);
    }

    if (content_type) {
      query = query.eq('content_type', content_type);
    }

    const { data: annotations, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('Get annotations - database error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({
      annotations: annotations || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('Get annotations error:', error);
    return NextResponse.json({ error: 'Failed to get annotations' }, { status: 500 });
  }
}

// POST /api/annotations - Create a new annotation
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Check annotation limit for free users
    const canAdd = await checkAnnotationLimit(supabase, user.id);
    if (!canAdd) {
      return NextResponse.json({
        error: 'Annotation limit reached. Please upgrade to Pro for unlimited annotations.',
      }, { status: 403 });
    }

    const body = await request.json();
    const {
      bookmark_id,
      content,
      content_type,
      highlight_start,
      highlight_end,
      highlight_text,
      visibility,
    } = body;

    // Validate required fields
    if (!bookmark_id) {
      return NextResponse.json({ error: 'Bookmark ID is required' }, { status: 400 });
    }

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify the bookmark belongs to the user
    const { data: bookmark, error: bookmarkError } = await supabase
      .from('bookmarks')
      .select('id')
      .eq('id', bookmark_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (bookmarkError || !bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    const { data: annotation, error } = await supabase
      .from('annotations')
      .insert({
        user_id: user.id,
        bookmark_id,
        content: content.trim(),
        content_type: content_type ?? 'note',
        highlight_start: highlight_start ?? null,
        highlight_end: highlight_end ?? null,
        highlight_text: highlight_text ?? null,
        visibility: visibility ?? 'private',
      })
      .select()
      .single();

    if (error) {
      console.error('Create annotation - database error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ annotation }, { status: 201 });
  } catch (error) {
    // Distinguish between client and server errors
    if (error instanceof SyntaxError) {
      // JSON parsing errors - client error
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    // Other errors (including TypeError) are server-side failures
    console.error('Create annotation - unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
