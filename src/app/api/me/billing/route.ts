import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/ssr';
import { getPlanId } from '@/lib/subscription/plans';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';

export async function GET(request: NextRequest) {
  const supabase = createClient();

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Failed to get user' },
        { status: 401 }
      );
    }

    // Get user's billing data from profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch billing data' },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    const currentPlan = profile.subscription_tier || 'free';
    const limits = SUBSCRIPTION_PLANS[currentPlan]?.limits || SUBSCRIPTION_PLANS.free.limits;

    // Get subscription and invoice data
    let subscriptionData = null;
    let invoices = [];

    if (profile.stripe_customer_id) {
      try {
        // Fetch subscription data from Stripe
        const subscriptionsResponse = await fetch(
          `https://api.stripe.com/v1/customers/${profile.stripe_customer_id}/subscriptions`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            },
          }
        );

        if (subscriptionsResponse.ok) {
          const subscriptions = await subscriptionsResponse.json();
          const activeSubscription = subscriptions.data.find(
            (sub: any) => sub.status === 'active' || sub.status === 'trialing'
          );

          if (activeSubscription) {
            subscriptionData = {
              id: activeSubscription.id,
              currentPlan: currentPlan,
              status: activeSubscription.status,
              nextBillingDate: activeSubscription.current_period_end,
              cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
            };
          }
        }

        // Fetch invoices
        const invoicesResponse = await fetch(
          `https://api.stripe.com/v1/invoices?customer=${profile.stripe_customer_id}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            },
          }
        );

        if (invoicesResponse.ok) {
          const invoicesData = await invoicesResponse.json();
          invoices = invoicesData.data.map((invoice: any) => ({
            id: invoice.id,
            date: invoice.created,
            amount: invoice.amount_paid / 100,
            status: invoice.status,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
          })).slice(0, 10); // Last 10 invoices
        }
      } catch (stripeError) {
        console.error('Error fetching Stripe data:', stripeError);
        // Continue with default data
      }
    }

    return NextResponse.json({
      currentPlan,
      nextBillingDate: subscriptionData?.nextBillingDate || null,
      cardLast4: null, // Could be fetched from Stripe customer
      cardExpiry: null, // Could be fetched from Stripe customer
      invoices,
      usage: {
        bookmarksUsed: 0, // Should be fetched from database
        bookmarksLimit: limits.bookmarks,
        collectionsUsed: 0, // Should be fetched from database
        collectionsLimit: limits.collections,
      },
    });
  } catch (error) {
    console.error('Error fetching billing data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch billing data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (body.action === 'portal') {
      // Open Stripe customer portal
      const { data: { portal } } = await supabase
        .rpc('get_stripe_portal_url', {
          params: {
            user_id: body.userId,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
          },
        });

      if (!portal.portal_url) {
        return NextResponse.json(
          { error: 'Failed to generate portal URL' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        portalUrl: portal.portal_url,
      });
    }

    if (body.action === 'cancel') {
      const userId = body.userId;

      // Get user's current subscription
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single();

      if (!subscription) {
        return NextResponse.json(
          { error: 'No active subscription found' },
          { status: 400 }
        );
      }

      // Cancel subscription
      const { error: cancelError } = await supabase
        .from('subscriptions')
        .update({
          status: 'canceled',
        canceled_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      // Send webhook event
      await supabase
        .from('subscription_events')
        .insert({
          user_id: userId,
          event_type: 'subscription_canceled',
          event_data: {
            subscription_id: subscription.id,
            old_plan: subscription.plan_id,
            new_plan: null,
            created_at: new Date().toISOString(),
          },
        });

      return NextResponse.json({
        success: true,
        message: 'Subscription canceled successfully',
      });
    }

    return NextResponse.json(
      { error: 'Unsupported action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error handling billing request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}
