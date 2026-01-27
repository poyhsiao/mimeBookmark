import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // Skip auth check for E2E testing when BOTH env var AND cookie are set (only in non-production environments)
  const e2eTestModeCookie = request.cookies.get('e2e-test-mode');
  const isE2ETesting = process.env.E2E_USE_MOCK === 'true' &&
                       e2eTestModeCookie?.value === 'true' &&
                       process.env.NODE_ENV !== 'production';

  if (isE2ETesting) {
    console.log('[MIDDLEWARE] E2E test mode detected, skipping auth check');
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Protected routes
  const protectedPaths = ['/dashboard', '/settings', '/collections', '/bookmarks'];
  const isProtectedPath = protectedPaths.some(p =>
    request.nextUrl.pathname.startsWith(p)
  );

  // Skip auth check for E2E testing when ALL three conditions are met:
  // - E2E_USE_MOCK env var is 'true'
  // - e2e-test-mode cookie is present
  // - NODE_ENV is not 'production'
  // (controlled by isE2ETesting boolean)
  if (isProtectedPath && !session && !isE2ETesting) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/collections/:path*', '/bookmarks/:path*'],
};
