import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON' },
      { status: 400 }
    );
  }

  const { sessionId } = body ?? {};

  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    );
  }

    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stripe API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to verify session with Stripe' },
        { status: response.status }
      );
    }

    const sessionData = await response.json();

    if (sessionData.payment_status !== 'paid') {
      return NextResponse.json({
        error: 'Payment was not successful',
        message: `Payment status: ${sessionData.payment_status}`,
      }, { status: 402 });
    }

    if (!sessionData.metadata || !sessionData.metadata.userId) {
      return NextResponse.json(
        { error: 'Session metadata is missing userId' },
        { status: 400 }
      );
    }

    if (sessionData.metadata.userId !== user.id) {
      return NextResponse.json(
        { error: 'Session does not belong to authenticated user' },
        { status: 403 }
      );
    }

    if (!sessionData.metadata.planId) {
      return NextResponse.json(
        { error: 'Session metadata is missing planId' },
        { status: 400 }
      );
    }

    // Note: Subscription activation is handled asynchronously by the Stripe webhook
    // (checkout.session.completed in src/lib/stripe/webhook.ts), which updates the
    // profiles table (subscription_tier, subscription_status, etc.). Monitor webhook
    // delivery and implement retries for webhook failures to ensure activation completes.
    return NextResponse.json({
      success: true,
      message: 'Payment verified successfully. Subscription activation will be completed asynchronously via webhook.',
      planId: sessionData.metadata.planId,
    });
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Verification timeout' },
        { status: 504 }
      );
    }

    console.error('Error verifying session:', error);
    return NextResponse.json(
      { error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}
