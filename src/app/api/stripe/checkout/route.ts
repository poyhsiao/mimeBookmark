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

    const body = await request.json();
    const { planId, successUrl, cancelUrl } = body as {
      planId: PlanType;
      successUrl: string;
      cancelUrl: string;
    };

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email')
      .eq('id', user.id)
      .single();

    const session = await createCheckoutSession({
      priceId: plan.priceId,
      customerId: profile?.stripe_customer_id || undefined,
      customerEmail: profile?.email || user.email,
      successUrl: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?success=true`,
      cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing?canceled=true`,
      mode: 'subscription',
      metadata: {
        userId: user.id,
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
