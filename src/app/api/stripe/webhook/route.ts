import { NextRequest, NextResponse } from 'next/server';
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
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}
