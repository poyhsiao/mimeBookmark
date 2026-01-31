import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/ssr';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json();
    const { sessionId, planId } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!planId) {
      return NextResponse.json(
        { error: 'Plan ID is required' },
        { status: 400 }
      );
    }

    // Verify session with Stripe
    const response = await fetch('https://api.stripe.com/v1/sessions/' + sessionId, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        'expand[]': 'total_cents_amount',
      }).toString(),
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

    // Check if payment was successful
    if (sessionData.payment_status === 'paid') {
      return NextResponse.json({
        success: true,
        message: 'Subscription activated successfully',
        planId: planId,
      });
    }

    return NextResponse.json({
      error: 'Payment was not successful',
      message: `Payment status: ${sessionData.payment_status}`,
    });
  } catch (error) {
    console.error('Error verifying session:', error);
    return NextResponse.json(
      { error: 'Failed to verify session' },
      { status: 500 }
    );
  }
}
