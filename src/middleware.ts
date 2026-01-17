import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
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
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  const protectedPaths = ['/dashboard', '/settings', '/collections', '/bookmarks'];
  const isProtectedPath = protectedPaths.some(p =>
    request.nextUrl.pathname.startsWith(p)
  );

  if (isProtectedPath && !session) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const duration = Date.now() - startTime;
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID();
  response.headers.set('x-request-id', requestId);

  if (process.env.NODE_ENV !== 'production' || process.env.LOG_REQUESTS === 'true') {
    const logLevel = duration > 1000 ? 'WARN' : 'INFO';
    const logMessage = `${request.method} ${request.nextUrl.pathname} ${response.status}`;
    console[logLevel === 'WARN' ? 'warn' : 'log'](
      `[${new Date().toISOString()}] [${logLevel}] [middleware] ${logMessage} (${duration}ms) [request-id: ${requestId}]`
    );
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/settings/:path*', '/collections/:path*', '/bookmarks/:path*'],
};
