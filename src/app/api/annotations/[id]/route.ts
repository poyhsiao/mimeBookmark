import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/annotations/:id - Get a single annotation
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
    const { id } = await params;

    const { data: annotation, error } = await supabase
      .from('annotations')
      .select(`
        *,
        bookmarks:bookmarks!inner(
          id,
          title,
          url,
          domain
        )
      `)
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
      }

      console.error('Error fetching annotation', error);

      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    return NextResponse.json({ annotation });
  } catch (error) {
    console.error('Get annotation error:', error);
    return NextResponse.json({ error: 'Failed to get annotation' }, { status: 500 });
  }
}

// PUT /api/annotations/:id - Update an annotation
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const {
      content,
      content_type,
      highlight_start,
      highlight_end,
      highlight_text,
      visibility,
    } = body;

    // Verify the annotation belongs to the user
    const { data: existing, error: checkError } = await supabase
      .from('annotations')
      .select('id, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
      }

      console.error('Error verifying annotation ownership', checkError);
      return NextResponse.json(
        { error: 'Failed to verify annotation' },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (content !== undefined) {
      if (typeof content !== 'string' || content.trim().length === 0) {
        return NextResponse.json({ error: 'Content cannot be empty' }, { status: 400 });
      }
      updateData.content = content.trim();
    }

    if (content_type !== undefined) {
      updateData.content_type = content_type;
    }

    if (highlight_start !== undefined) {
      updateData.highlight_start = highlight_start;
    }

    if (highlight_end !== undefined) {
      updateData.highlight_end = highlight_end;
    }

    if (highlight_text !== undefined) {
      updateData.highlight_text = highlight_text;
    }

    if (visibility !== undefined) {
      updateData.visibility = visibility;
    }

    const { data: annotation, error } = await supabase
      .from('annotations')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('Update annotation - database error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ annotation });
  } catch (error) {
    // Distinguish between client and server errors
    if (error instanceof SyntaxError) {
      // JSON parsing errors - client error
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    // Other errors are server-side failures
    console.error('Update annotation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/annotations/:id - Soft delete an annotation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Verify the annotation belongs to the user
    const { data: existing, error: checkError } = await supabase
      .from('annotations')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (checkError) {
      if (checkError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
      }

      console.error('Error verifying annotation ownership', checkError);
      return NextResponse.json(
        { error: 'Failed to verify annotation' },
        { status: 500 }
      );
    }

    if (!existing) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    // Soft delete
    const { error } = await supabase
      .from('annotations')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Delete annotation - database error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Annotation deleted' });
  } catch (error) {
    console.error('Delete annotation error:', error);
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}
