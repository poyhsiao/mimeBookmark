import Stripe from 'stripe';
import { getWebhookSecret, stripe } from './server';

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = getWebhookSecret();
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret) as Stripe.Event;
}

export type WebhookHandler<T = unknown> = (
  event: Stripe.Event
) => Promise<T> | T;

export interface WebhookEventHandlers {
  'checkout.session.completed': WebhookHandler<{ sessionId: string; customerId: string }>;
  'customer.subscription.created': WebhookHandler<{ subscription: Stripe.Subscription }>;
  'customer.subscription.updated': WebhookHandler<{ subscription: Stripe.Subscription }>;
  'customer.subscription.deleted': WebhookHandler<{ subscription: Stripe.Subscription }>;
  'invoice.paid': WebhookHandler<{ invoice: Stripe.Invoice }>;
  'invoice.payment_failed': WebhookHandler<{ invoice: Stripe.Invoice }>;
}

export async function handleWebhookEvent(
  event: Stripe.Event
): Promise<{ success: boolean; message: string }> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'subscription' && session.subscription) {
        await handleCheckoutCompleted(session);
      }
      return { success: true, message: 'Checkout session handled' };
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(subscription);
      return { success: true, message: 'Subscription updated' };
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(subscription);
      return { success: true, message: 'Subscription canceled' };
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoicePaid(invoice);
      return { success: true, message: 'Invoice payment recorded' };
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      await handleInvoiceFailed(invoice);
      return { success: true, message: 'Payment failure recorded' };
    }
    default:
      return { success: true, message: `Unhandled event type: ${event.type}` };
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  console.log('Checkout completed:', session.id);

  let subscription: Stripe.Subscription;

  if (typeof session.subscription === 'string') {
    try {
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    } catch (error) {
      console.error('Failed to retrieve subscription:', error);
      return;
    }
  } else if (session.subscription && typeof session.subscription === 'object') {
    subscription = session.subscription;
  } else {
    console.error('No valid subscription found in checkout session');
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  console.log('Subscription price ID:', priceId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  console.log('Subscription updated:', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  console.log('Subscription deleted:', subscription.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  console.log('Invoice paid:', invoice.id);
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log('Invoice payment failed:', invoice.id);
}
