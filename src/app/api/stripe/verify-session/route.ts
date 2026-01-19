import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover' as any,
});

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

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'subscription.items.data.price'],
    });

    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json(
        { error: 'Payment not completed or session not found' },
        { status: 400 }
      );
    }

    // Fetch the user's profile to get their Stripe customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    // Verify the session belongs to this user
    const sessionCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

    const emailMatches = session.customer_email != null && user.email != null && session.customer_email === user.email;
    const customerIdMatches = profile?.stripe_customer_id != null && sessionCustomerId != null && sessionCustomerId === profile.stripe_customer_id;

    if (!emailMatches && !customerIdMatches) {
      return NextResponse.json(
        { error: 'Session does not belong to this user' },
        { status: 403 }
      );
    }

    // Ensure session has a subscription (this endpoint is for subscription checkout only)
    if (!session.subscription) {
      console.error('No subscription found in session');
      return NextResponse.json(
        { error: 'This session does not contain a subscription. Please use the correct checkout flow.' },
        { status: 400 }
      );
    }

    // Determine the plan from the session
    const subscription = session.subscription as Stripe.Subscription;

    // Guard against empty items array
    if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
      console.error('Subscription has no items or empty items array');
      return NextResponse.json(
        { error: 'Invalid subscription: no items found' },
        { status: 400 }
      );
    }

    const priceId = subscription.items.data[0].price.id;

    // Build price-to-plan map only from configured (non-empty) environment variables
    const pricePlanMap: Record<string, string> = {};
    if (process.env.STRIPE_PRICE_PRO_MONTHLY) {
      pricePlanMap[process.env.STRIPE_PRICE_PRO_MONTHLY] = 'pro';
    }
    if (process.env.STRIPE_PRICE_PRO_YEARLY) {
      pricePlanMap[process.env.STRIPE_PRICE_PRO_YEARLY] = 'pro';
    }
    if (process.env.STRIPE_PRICE_TEAM_MONTHLY) {
      pricePlanMap[process.env.STRIPE_PRICE_TEAM_MONTHLY] = 'team';
    }
    if (process.env.STRIPE_PRICE_TEAM_YEARLY) {
      pricePlanMap[process.env.STRIPE_PRICE_TEAM_YEARLY] = 'team';
    }

    // Look up the plan; must be valid
    let plan: string;
    if (priceId && pricePlanMap[priceId]) {
      plan = pricePlanMap[priceId];
    } else {
      // Unknown or unconfigured price ID
      console.error('Unknown or unconfigured Stripe price ID:', priceId);
      return NextResponse.json(
        { error: 'Unknown subscription plan. Please contact support.' },
        { status: 400 }
      );
    }

    // Update the user's profile with the new subscription
    // plan is guaranteed to be 'pro' or 'team' from pricePlanMap
    const subscriptionTier = plan;
    const subscriptionStatus = session.subscription
      ? (session.subscription as Stripe.Subscription).status
      : 'active';

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        subscription_tier: subscriptionTier,
        subscription_status: subscriptionStatus,
        subscription_id: session.subscription
          ? (session.subscription as Stripe.Subscription).id
          : null,
        stripe_customer_id: session.customer
          ? typeof session.customer === 'string'
            ? session.customer
            : session.customer.id
          : null,
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
