import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { constructWebhookEvent, handleWebhookEvent } from '@/lib/stripe/webhook';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      );
    }

    const event = constructWebhookEvent(body, signature);
    const result = await handleWebhookEvent(event);

    return NextResponse.json(result);
  } catch (error: any) {
    const errorName = error.name || 'UnknownError';
    const errorMessage = error.message || 'No error message provided';
    console.error(`Webhook error: ${errorName} - ${errorMessage}`);

    if (error.type === 'StripeSignatureVerificationError' || error.name === 'StripeSignatureVerificationError') {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
