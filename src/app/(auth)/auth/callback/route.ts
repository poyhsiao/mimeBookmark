import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function isValidRedirect(url: string): boolean {
  // Must start with '/' but not '//' (to prevent protocol-relative URLs)
  // Must not contain protocol (http:, https:, javascript:, etc.)
  if (!url || !url.startsWith('/') || url.startsWith('//')) {
    return false;
  }

  // Reject if contains protocol
  if (url.includes('://')) {
    return false;
  }

  return true;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next') || '/dashboard';

  // Validate redirect URL to prevent open redirect vulnerability
  // Only allow same-origin relative paths starting with '/' but not '//'
  const next = isValidRedirect(nextParam) ? nextParam : '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return redirect(next);
    }
  }

  return redirect('/login?error=auth_callback_failed');
}
