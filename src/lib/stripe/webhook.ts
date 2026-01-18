import Stripe from 'stripe';
import { getWebhookSecret, stripe } from './server';
import { createClient } from '@/lib/supabase/server';
import { getPlanByPriceId } from '@/lib/subscription/plans';

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (customer === null) {
    return null;
  }
  if (typeof customer === 'string') {
    return customer;
  }
  return customer.id;
}

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

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<string | null> {
  console.log('Checkout completed:', session.id);

  const supabase = await createClient();

  let subscription: Stripe.Subscription;

  if (typeof session.subscription === 'string') {
    try {
      subscription = await stripe.subscriptions.retrieve(session.subscription);
    } catch (error: any) {
      throw new Error(`Failed to retrieve subscription ${session.subscription}: ${error.message}`);
    }
  } else if (session.subscription && typeof session.subscription === 'object') {
    subscription = session.subscription as Stripe.Subscription;
  } else {
    throw new Error(`No valid subscription found in checkout session ${session.id}`);
  }

  if (!subscription.items?.data || subscription.items.data.length === 0) {
    throw new Error(`Subscription ${subscription.id} has no items`);
  }

  const firstItem = subscription.items.data[0];
  if (!firstItem?.price) {
    throw new Error(`Subscription ${subscription.id} first item has no price`);
  }

  const priceId = firstItem.price.id;
  console.log('Subscription price ID:', priceId);

  const customerId = getCustomerId(session.customer);

  if (!customerId) {
    throw new Error(`No customer in checkout session: ${session.id}`);
  }

  const plan = priceId ? getPlanByPriceId(priceId) : null;

  if (!plan) {
    const error = new Error(`Plan lookup failed for unrecognized price ID: ${priceId}, event: ${session.id}`);
    console.error(error.message);
    throw error;
  }

  const userId = session.client_reference_id || session.metadata?.user_id;
  if (!userId) {
    throw new Error(`No user identifier found in session: ${session.id}, missing client_reference_id and metadata.user_id`);
  }

  const { data: updatedProfile, error: updateError } = await supabase
    .from('profiles')
    .update({
      stripe_customer_id: customerId,
      subscription_id: subscription.id,
      subscription_tier: plan.id,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select();

  if (updateError) {
    throw new Error(`Failed to update profile on checkout: ${updateError.message}`);
  }

  if (!updatedProfile || updatedProfile.length === 0) {
    throw new Error(`Profile not found or not updated for userId: ${userId}, customerId: ${customerId}`);
  }

  return priceId;
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const supabase = await createClient();

  const customerId = getCustomerId(subscription.customer);

  if (!customerId) {
    throw new Error(`No customer ID found in subscription: ${subscription.id}`);
  }

  let { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  // Fallback: Attempt to find profile using subscription metadata if initial lookup fails
  if (profileError || !profiles) {
    console.warn(`Profile not found by stripe_customer_id: ${customerId}, attempting fallback lookup`);

    const userId = subscription.metadata?.userId || subscription.metadata?.user_id;

    if (userId) {
      console.log(`Attempting fallback lookup with metadata userId: ${userId}`);
      const { data: fallbackProfile, error: fallbackError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!fallbackError && fallbackProfile) {
        profiles = fallbackProfile;
        profileError = null;
        console.log(`Successfully found profile via fallback lookup: ${userId}`);
      }
    }

    // If both lookups fail, throw error to trigger webhook retry
    if (profileError || !profiles) {
      const errorMessage = `Profile not found for customer: ${customerId}, subscription: ${subscription.id}, error: ${profileError?.message || 'not found'}. This may be a race condition.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  const firstItem = subscription.items?.data?.[0];
  const priceId = firstItem?.price?.id;
  const plan = priceId ? getPlanByPriceId(priceId) : null;

  if (!plan) {
    throw new Error(`Plan lookup failed for unrecognized price ID: ${priceId}, subscription: ${subscription.id}`);
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: subscription.status,
      subscription_tier: plan.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profiles.id);

  if (updateError) {
    throw new Error(`Failed to update subscription profile: ${updateError.message}`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const supabase = await createClient();

  const customerId = getCustomerId(subscription.customer);

  if (!customerId) {
    throw new Error(`No customer ID in subscription: ${subscription.id}`);
  }

  let { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  // Fallback: Attempt to find profile using subscription metadata if initial lookup fails
  if (profileError || !profiles) {
    console.warn(`Profile not found by stripe_customer_id: ${customerId}, attempting fallback lookup`);

    const userId = subscription.metadata?.userId || subscription.metadata?.user_id;

    if (userId) {
      console.log(`Attempting fallback lookup with metadata userId: ${userId}`);
      const { data: fallbackProfile, error: fallbackError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (!fallbackError && fallbackProfile) {
        profiles = fallbackProfile;
        profileError = null;
        console.log(`Successfully found profile via fallback lookup: ${userId}`);
      }
    }

    // If both lookups fail, throw error to trigger webhook retry
    if (profileError || !profiles) {
      const errorMessage = `Profile not found for customer: ${customerId}, subscription: ${subscription.id}, error: ${profileError?.message || 'not found'}. This may be a race condition.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      subscription_tier: 'free',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profiles.id);

  if (updateError) {
    throw new Error(`Failed to update subscription profile: ${updateError.message}`);
  }
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const supabase = await createClient();

  const customerId = getCustomerId(invoice.customer);

  if (!customerId) {
    throw new Error(`No customer ID in invoice: ${invoice.id}`);
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profiles) {
    throw new Error(`Profile not found for customer: ${customerId}, error: ${profileError?.message || 'not found'}`);
  }

  // Use invoice.parent.subscription_details.subscription when available (newer API)
  // Fall back to invoice.subscription for older API versions
  let invoiceSubscriptionId: string | Stripe.Subscription | null = null;

  if (invoice.parent && typeof invoice.parent === 'object' && invoice.parent.type === 'subscription_details') {
    // Newer API: extract from parent.subscription_details
    const parent = invoice.parent as any;
    if (parent.subscription_details?.subscription) {
      invoiceSubscriptionId = parent.subscription_details.subscription;
    }
  }

  // Fallback to deprecated invoice.subscription if parent not available
  if (!invoiceSubscriptionId && invoice.subscription) {
    invoiceSubscriptionId = invoice.subscription;
  }

  let subscription: Stripe.Subscription | null = null;

  if (invoiceSubscriptionId) {
    try {
      if (typeof invoiceSubscriptionId === 'string') {
        subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
      } else if (typeof invoiceSubscriptionId === 'object') {
        subscription = invoiceSubscriptionId as Stripe.Subscription;
      }
    } catch (error: any) {
      throw new Error(`Failed to retrieve subscription ${typeof invoiceSubscriptionId === 'string' ? invoiceSubscriptionId : invoiceSubscriptionId.id}: ${error.message}`);
    }
  }

  if (subscription && ['canceled', 'incomplete_expired', 'unpaid'].includes(subscription.status)) {
    console.log(`Subscription ${subscription.id} is in terminal state (${subscription.status}), not updating status to active`);
    return;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profiles.id);

  if (updateError) {
    throw new Error(`Failed to update subscription profile: ${updateError.message}`);
  }
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const supabase = await createClient();

  const customerId = getCustomerId(invoice.customer);

  if (!customerId) {
    throw new Error(`No customer ID in invoice: ${invoice.id}`);
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileError || !profiles) {
    throw new Error(`Profile not found for customer: ${customerId}, error: ${profileError?.message || 'not found'}`);
  }

  // Skip update if subscription is in a terminal state
  const terminalStates = ['canceled', 'incomplete_expired', 'unpaid'];
  if (terminalStates.includes(profiles.subscription_status)) {
    console.log(`Subscription for customer ${customerId} is in terminal state (${profiles.subscription_status}), skipping past_due update`);
    return;
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profiles.id);

  if (updateError) {
    throw new Error(`Failed to update subscription profile: ${updateError.message}`);
  }
}
