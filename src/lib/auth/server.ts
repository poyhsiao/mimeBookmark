import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );
}

export async function getCurrentUser() {
  const cookieStore = cookies();

  // Check for E2E test mode - requires BOTH env var AND cookie (restricted to non-production environments)
  const e2eTestModeCookie = cookieStore.get('e2e-test-mode');
  const isE2ETesting = process.env.E2E_USE_MOCK === 'true' &&
                       e2eTestModeCookie?.value === 'true' &&
                       process.env.NODE_ENV !== 'production';

  if (isE2ETesting) {
    // Return mock user for E2E testing
    return {
      error: null,
      user: {
        id: 'test-user-123',
        email: 'test@example.com',
        email_confirmed_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {
          full_name: 'Test User',
        },
        created_at: new Date().toISOString(),
        aud: 'authenticated',
      },
    };
  }

  const supabase = await createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: error?.message || 'No user found', user: null };
  }

  return { error: null, user };
}

export async function getSession() {
  const supabase = await createServerSupabase();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    return { error: error.message, session: null };
  }

  return { error: null, session };
}
