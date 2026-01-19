import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCustomerPortalSession } from '@/lib/stripe/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { returnUrl } = body as { returnUrl?: string };

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    const session = await createCustomerPortalSession(
      profile.stripe_customer_id,
      returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`
    );

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal session error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}
