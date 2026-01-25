import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/me/sessions/[id] - Get session details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .select(`
        *,
        session_devices (
          id,
          device_name,
          device_type,
          platform,
          os,
          user_agent,
          created_at
        )
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching session:', error);
      return NextResponse.json(
        { error: 'Failed to fetch session' },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Transform session_devices array to device property
    const sessionDevices = (session as any).session_devices;
    const device = Array.isArray(sessionDevices) && sessionDevices.length > 0
      ? sessionDevices[0]
      : null;

    // Remove session_devices and add device
    const { session_devices: _, ...rest } = session as any;

    return NextResponse.json({ session: { ...rest, device } });
  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// DELETE /api/me/sessions/[id] - Revoke a single session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: session, error: fetchError } = await supabase
      .from('sessions')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching session:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch session' },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error revoking session:', error);
    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}

// PUT /api/me/sessions/[id] - Update session display name
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id } = await params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('user_id, display_name')
      .eq('id', id)
      .maybeSingle();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return NextResponse.json(
        { error: 'Failed to fetch session' },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Malformed JSON body' },
        { status: 400 }
      );
    }
    const { display_name } = body;

    // Validate and sanitize display_name
    if (display_name !== undefined && display_name !== null) {
      if (typeof display_name !== 'string') {
        return NextResponse.json(
          { error: 'Display name must be a string' },
          { status: 400 }
        );
      }
      const trimmed = display_name.trim();
      if (trimmed.length > 100) {
        return NextResponse.json(
          { error: 'Display name must be 100 characters or less' },
          { status: 400 }
        );
      }
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: 'Display name cannot be empty or whitespace only' },
          { status: 400 }
        );
      }
      // Sanitize: remove any control characters and limit allowed characters
      const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, '');
      if (sanitized !== trimmed) {
        return NextResponse.json(
          { error: 'Display name contains invalid characters' },
          { status: 400 }
        );
      }

      const { data: updatedSession, error } = await supabase
        .from('sessions')
        .update({ display_name: sanitized })
        .eq('id', id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json({ success: true, session: updatedSession });
    }

    // display_name is required for PUT requests
    return NextResponse.json(
      { success: false, error: 'display_name is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error updating session metadata:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}
