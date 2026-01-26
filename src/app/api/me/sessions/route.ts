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

// Helper to compute SHA-256 hash for token_hash
async function computeTokenHash(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Factory function to build device query for reuse in retry logic
function buildDeviceQuery(
  supabase: any,
  userId: string,
  deviceName: string,
  platform: string,
  os: string | null,
  deviceType: string | null
) {
  let query = supabase
    .from('session_devices')
    .select('*')
    .eq('user_id', userId)
    .eq('device_name', deviceName)
    .eq('platform', platform);

  // Handle os: either filter by value or explicitly match NULL
  if (os) {
    query = query.eq('os', os);
  } else {
    query = query.is('os', null);
  }

  // Handle device_type: either filter by value or explicitly match NULL
  if (deviceType) {
    query = query.eq('device_type', deviceType);
  } else {
    query = query.is('device_type', null);
  }

  return query;
}

// Helper to transform session response to match frontend format
function transformSessionResponse(session: any): any {
  const sessionDevices = (session as any).session_devices;
  const device = Array.isArray(sessionDevices) && sessionDevices.length > 0
    ? sessionDevices[0]
    : null;

  // Remove session_devices and add device
  const { session_devices: _, ...rest } = session as any;
  return { ...rest, device };
}

// Types for session management
interface SessionDevice {
  id: string;
  user_id: string | null;
  device_name: string | null;
  device_type: string | null;
  platform: string | null;
  os: string | null;
  user_agent: string | null;
  created_at: string;
}

interface Session {
  id: string;
  user_id: string | null;
  device_id: string | null;
  session_token?: string; // Optional: only included in response, not stored in DB
  display_name: string | null;
  is_active: boolean;
  last_active_at: string;
  created_at: string;
  updated_at: string;
  device?: SessionDevice;
}

interface SessionActivity {
  id: string;
  session_id: string;
  activity_type: string;
  details: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
}

// GET /api/me/sessions - List all user's sessions
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current Supabase auth session ID for comparison
    // Extract session_id from JWT access_token claim
    const { data: sessionData } = await supabase.auth.getSession();
    const currentAuthSessionId = sessionData?.session?.access_token
      ? getSessionIdFromToken(sessionData.session.access_token)
      : null;

    const { data: sessions, error } = await supabase
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
      .eq('user_id', user.id)
      .order('last_active_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      );
    }

    // Transform session_devices array to device property
    const transformedSessions = sessions.map(session => {
      const sessionDevices = (session as any).session_devices;
      const device = Array.isArray(sessionDevices) && sessionDevices.length > 0
        ? sessionDevices[0]
        : null;

      // Remove session_devices and add device
      const { session_devices: _, ...rest } = session as any;
      return {
        ...rest,
        device,
        is_current: (session as any).auth_session_id === currentAuthSessionId,
      };
    });

    return NextResponse.json({ sessions: transformedSessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST /api/me/sessions - Create a new session (idempotent: reuses existing session for same device)
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

    let body: Record<string, any>;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        { error: 'Malformed JSON' },
        { status: 400 }
      );
    }
    const {
      device_name,
      device_type,
      platform,
      os,
      user_agent,
      display_name,
    } = body;

    // Validate required fields (device_type is optional)
    if (!device_name || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: device_name, platform' },
        { status: 400 }
      );
    }

    // Check for existing device with same fingerprint
    const deviceQuery = buildDeviceQuery(
      supabase,
      user.id,
      device_name,
      platform,
      os,
      device_type
    );

    const { data: existingDevice } = await deviceQuery.maybeSingle();

    let deviceId: string;

    if (existingDevice) {
      deviceId = existingDevice.id;
    } else {
      // Create new device
      const { data: newDevice, error: deviceError } = await supabase
        .from('session_devices')
        .insert({
          user_id: user.id,
          device_name,
          device_type,
          platform,
          os,
          user_agent: user_agent || null,
        })
        .select()
        .single();

      if (deviceError) {
        // Check for unique constraint violation (Postgres error code 23505)
        // This can happen when two concurrent requests try to insert the same device fingerprint
        if (deviceError.code === '23505' || deviceError.message.includes('unique') || deviceError.message.includes('idx_session_devices_fingerprint')) {
          // Retry: rebuild the query and look up the device again (it should exist now after the race was won)
          const retryQuery = buildDeviceQuery(
            supabase,
            user.id,
            device_name,
            platform,
            os,
            device_type
          );

          const { data: retryDevice } = await retryQuery.maybeSingle();

          if (retryDevice) {
            deviceId = retryDevice.id;
          } else {
            // If retry still fails, throw the original error
            throw deviceError;
          }
        } else {
          // For other errors, throw immediately
          throw deviceError;
        }
      } else {
        deviceId = newDevice.id;
      }
    }

    // Check for existing active session for this user and device
    // Note: For atomicity, we use upsert with ON CONFLICT.
    // This requires a unique partial index on sessions: UNIQUE(user_id, device_id) WHERE is_active = true
    // If this index doesn't exist, add it via migration.
    const token = crypto.randomUUID();
    const hash = await computeTokenHash(token);

    // Get current auth session ID for storage
    // Extract session_id from JWT access_token claim
    const { data: currentAuthSession } = await supabase.auth.getSession();
    const authSessionId = currentAuthSession?.session?.access_token
      ? getSessionIdFromToken(currentAuthSession.session.access_token)
      : null;

    const now = new Date().toISOString();
    const sessionPayload = {
      user_id: user.id,
      device_id: deviceId,
      token_hash: hash,
      auth_session_id: authSessionId || null,
      display_name: display_name || null,
      is_active: true,
      last_active_at: now,
    };

    // Use upsert for atomic insert-or-update
    // onConflict: ['user_id', 'device_id'] assumes unique partial index exists
    const { data: upsertedSession, error: upsertError } = await supabase
      .from('sessions')
      .upsert(sessionPayload, {
        onConflict: 'user_id,device_id',
        ignoreDuplicates: false,
      })
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
      .single();

    // Determine insert vs update based on timestamps from the upsert result
    // For inserts: created_at == updated_at (both set to NOW() at insert time)
    // For updates: updated_at > created_at (updated_at is NOW(), created_at is older)
    const isUpdate = upsertedSession && new Date(upsertedSession.updated_at).getTime() > new Date(upsertedSession.created_at).getTime();

    if (upsertError) {
      // If upsert fails due to missing unique index, fall back to the two-step approach
      // This can happen if the database migration hasn't been applied yet
      console.warn('Upsert failed, falling back to two-step approach:', upsertError);

      const { data: existingSession } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('device_id', deviceId)
        .maybeSingle();

      if (existingSession) {
        // Update existing session with new token hash
        const { data: updatedSession, error: updateError } = await supabase
          .from('sessions')
          .update({
            token_hash: hash,
            auth_session_id: authSessionId || null,
            last_active_at: now,
            display_name: display_name || existingSession.display_name,
          })
          .eq('id', existingSession.id)
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
          .single();

        if (updateError) {
          throw updateError;
        }

        const transformedSession = transformSessionResponse(updatedSession);
        return NextResponse.json({ session: { ...transformedSession, token } }, { status: 200 });
      } else {
        // Create new session
        const { data: newSession, error: sessionError } = await supabase
          .from('sessions')
          .insert(sessionPayload)
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
          .single();

        if (sessionError) {
          throw sessionError;
        }

        const transformedSession = transformSessionResponse(newSession);
        return NextResponse.json({ session: { ...transformedSession, token } }, { status: 201 });
      }
    }

    // Return 201 for new sessions, 200 for updated sessions
    // Determined by pre-upsert query, not by timestamp heuristic
    const responseStatus = isUpdate ? 200 : 201;

    const transformedSession = transformSessionResponse(upsertedSession);
    return NextResponse.json({ session: { ...transformedSession, token } }, { status: responseStatus });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
