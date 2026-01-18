import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCheckoutSession } from '@/lib/stripe/server';
import { getPlan, SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';
import type { PlanType } from '@/types/subscription';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { planId: PlanType; successUrl: string; cancelUrl: string };
    try {
      body = await request.json() as { planId: PlanType; successUrl: string; cancelUrl: string };
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { planId, successUrl, cancelUrl } = body;

    if (!planId || !successUrl || !cancelUrl) {
      return NextResponse.json({ error: 'Missing required fields: planId, successUrl, cancelUrl' }, { status: 400 });
    }

    if (!planId || !SUBSCRIPTION_PLANS[planId]) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    const plan = getPlan(planId);
    if (!plan.priceId) {
      return NextResponse.json(
        { error: 'Free plan cannot be purchased' },
        { status: 400 }
      );
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    if (error || !profile) {
      console.error('Error fetching profile:', error);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const validateAndNormalizeUrl = (url: string | undefined, defaultPath: string): string => {
      if (!url) {
        return `${appBaseUrl}${defaultPath}`;
      }

      try {
        const parsedUrl = new URL(url, appBaseUrl);
        const requestOrigin = new URL(request.url).origin;

        if (parsedUrl.origin !== requestOrigin && parsedUrl.origin !== appBaseUrl) {
          console.warn(`URL origin mismatch: ${parsedUrl.origin} != ${requestOrigin}, falling back to default`);
          return `${appBaseUrl}${defaultPath}`;
        }

        return parsedUrl.toString();
      } catch (error) {
        console.warn(`Invalid URL provided: ${url}, falling back to default`, error);
        return `${appBaseUrl}${defaultPath}`;
      }
    };

    const validatedSuccessUrl = validateAndNormalizeUrl(successUrl, '/settings/billing?success=true');
    const validatedCancelUrl = validateAndNormalizeUrl(cancelUrl, '/settings/billing?canceled=true');

    const session = await createCheckoutSession({
      priceId: plan.priceId,
      customerId: profile?.stripe_customer_id || undefined,
      customerEmail: profile?.email || user.email,
      successUrl: validatedSuccessUrl,
      cancelUrl: validatedCancelUrl,
      mode: 'subscription',
      clientReferenceId: user.id,
      metadata: {
        planId,
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout session error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
