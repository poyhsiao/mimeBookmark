import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // Restrict access to non-production environments AND require explicit E2E flag
  const isProduction = process.env.NODE_ENV === 'production';
  const hasE2EFlag = process.env.E2E_USE_MOCK === 'true';

  if (isProduction || !hasE2EFlag) {
    return NextResponse.json(
      { error: 'Not available' },
      { status: 403 }
    );
  }

  // Check for E2E test mode cookie
  const cookieStore = await cookies();
  const e2eTestModeCookie = cookieStore.get('e2e-test-mode');
  const isE2ETesting = e2eTestModeCookie?.value === 'true' &&
                       process.env.NODE_ENV !== 'production';

  // Skip authentication in E2E mock mode
  if (!isE2ETesting) {
    // Require authentication when not in E2E mode
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // Optional: Also check for debug token header for additional security
  const authHeader = request.headers.get('Authorization');
  const debugToken = request.headers.get('X-Debug-Token');

  // If either header is present, validate it (optional but recommended)
  if (authHeader || debugToken) {
    const expectedToken = process.env.E2E_DEBUG_TOKEN;

    // Reject if a token is provided but none is configured
    if (!expectedToken) {
      return NextResponse.json(
        { error: 'E2E debug token not configured' },
        { status: 401 }
      );
    }

    const providedToken = authHeader?.replace('Bearer ', '') || debugToken;

    if (providedToken !== expectedToken) {
      return NextResponse.json(
        { error: 'Invalid debug token' },
        { status: 401 }
      );
    }
  }

  // Return minimal info only - boolean and cookie presence
  return NextResponse.json({
    isE2EActive: hasE2EFlag,
    hasE2ECookie: !!e2eTestModeCookie,
  });
}
