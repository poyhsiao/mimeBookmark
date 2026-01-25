import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Helper to validate UUID v4 format.
 * Returns true if the string matches a valid UUID v4 pattern.
 */
function isValidUUIDv4(str: string): boolean {
  const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidV4Regex.test(str);
}

/**
 * Helper to decode JWT and extract session_id claim.
 * JWT format: header.payload.signature, where payload is base64url-encoded JSON.
 * We only need the payload (middle part), which contains the session_id claim.
 */
function getSessionIdFromToken(token: string): string | null {
  try {
    // Split JWT into parts and decode the payload (second part)
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url decode the payload
    const payload = parts[1];
    // Add padding if needed for base64 decoding
    const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
    // Replace base64url characters with standard base64
    const base64Payload = paddedPayload.replace(/-/g, '+').replace(/_/g, '/');

    // Decode using Buffer (available in Node.js/Next.js server environment)
    const decoded = Buffer.from(base64Payload, 'base64').toString('utf-8');
    const claims = JSON.parse(decoded);

    return claims.session_id || null;
  } catch {
    return null;
  }
}

// POST /api/me/sessions/revoke-all - Revoke all other sessions (except current)
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current auth session and extract session_id from JWT access_token
    // Supabase auth sessions have a session_id claim in the JWT payload
    const { data: sessionData } = await supabase.auth.getSession();
    const currentAuthSessionId = sessionData?.session?.access_token
      ? getSessionIdFromToken(sessionData.session.access_token)
      : null;

    // If we can't determine the current session ID, proceed with revoking all sessions
    // This is a safe fallback - the user will stay logged in due to their valid auth session
    if (!currentAuthSessionId) {
      console.warn('Unable to extract session_id from current auth session, revoking all sessions');
    }

    // Validate currentAuthSessionId format before using it in the filter
    const isValidSessionId = currentAuthSessionId && isValidUUIDv4(currentAuthSessionId);

    // Update all sessions except current to inactive.
    // The OR filter handles two cases:
    // 1. auth_session_id is NULL (legacy sessions or sessions without auth tracking)
    // 2. auth_session_id exists but is not the current session (only if validated)
    const orFilter = isValidSessionId
      ? `auth_session_id.is.null,auth_session_id.neq.${currentAuthSessionId}`
      : 'auth_session_id.is.null';

    const { data, error } = await supabase
      .from('sessions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .or(orFilter)
      .select();

    if (error) {
      throw error;
    }

    const revoked_count = Array.isArray(data) ? data.length : data ? 1 : 0;

    return NextResponse.json({ success: true, revoked_count });
  } catch (error) {
    console.error('Error revoking all sessions:', error);
    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}
