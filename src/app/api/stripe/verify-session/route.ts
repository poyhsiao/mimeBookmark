import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});

const PRICE_PLAN_MAP: Record<string, 'pro' | 'team'> = Object.fromEntries(
  [
    [process.env.STRIPE_PRICE_PRO_MONTHLY, 'pro'],
    [process.env.STRIPE_PRICE_PRO_YEARLY, 'pro'],
    [process.env.STRIPE_PRICE_TEAM_MONTHLY, 'team'],
    [process.env.STRIPE_PRICE_TEAM_YEARLY, 'team'],
  ].filter(([id]) => !!id) as [string, 'pro' | 'team'][],
);

function getSessionCustomerId(session: Stripe.Checkout.Session): string | null {
  if (!session.customer) return null;
  return typeof session.customer === 'string'
    ? session.customer
    : session.customer.id ?? null;
}

function sessionBelongsToUser(opts: {
  session: Stripe.Checkout.Session;
  user: { email?: string | null };
  profile: { stripe_customer_id?: string | null } | null;
}): boolean {
  const { session, user, profile } = opts;
  const sessionCustomerId = getSessionCustomerId(session);

  const emailMatches =
    session.customer_email != null &&
    user.email != null &&
    session.customer_email === user.email;

  const customerIdMatches =
    profile?.stripe_customer_id != null &&
    sessionCustomerId != null &&
    sessionCustomerId === profile.stripe_customer_id;

  return emailMatches || customerIdMatches;
}

function getPriceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const items = subscription.items?.data;
  if (!items || items.length === 0) {
    console.error('Subscription has no items or empty items array');
    return null;
  }
  return items[0]?.price?.id ?? null;
}

function resolvePlanFromSession(session: Stripe.Checkout.Session): { plan: 'pro' | 'team'; subscription: Stripe.Subscription } | null {
  if (!session.subscription) {
    console.error('No subscription found in session');
    return null;
  }

  const subscription = session.subscription as Stripe.Subscription;
  const priceId = getPriceIdFromSubscription(subscription);
  if (!priceId) return null;

  const plan = PRICE_PLAN_MAP[priceId] as 'pro' | 'team' | undefined;
  if (!plan) {
    console.error('Unknown or unconfigured Stripe price ID:', priceId);
    return null;
  }

  return { plan, subscription };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price'],
    });

    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed or session not found' },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!sessionBelongsToUser({ session, user, profile })) {
      return NextResponse.json(
        { error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    const result = resolvePlanFromSession(session);
    if (!result) {
      return NextResponse.json(
        { error: 'Unknown or invalid subscription plan. Please contact support.' },
        { status: 400 }
      );
    }

    const { plan, subscription } = result;

    const sessionCustomerId = getSessionCustomerId(session);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: plan,
        subscription_status: subscription.status,
        subscription_id: subscription.id,
        stripe_customer_id: sessionCustomerId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update user subscription:', updateError);
      return NextResponse.json(
        { error: 'Failed to update subscription' },
        { status: 500 }
      );
    }

    let message = 'Your subscription has been activated successfully!';

    if (plan === 'pro') {
      message = 'Welcome to Pro! You now have unlimited bookmarks, collections, and tags.';
    } else if (plan === 'team') {
      message = 'Welcome to Team! You can now invite team members and share collections.';
    }

    return NextResponse.json({
      success: true,
      plan,
      message,
    });
  } catch (error) {
    console.error('Verify session error:', error);
    return NextResponse.json(
      { error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}
