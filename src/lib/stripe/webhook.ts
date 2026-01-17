import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { stripe, getWebhookSecret } from './server';
import { getPlan, SUBSCRIPTION_PLANS } from '../subscription/plans';
import type { PlanType, SubscriptionStatus } from '@/types/subscription';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for webhook processing');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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

function getPlanTierFromPriceId(priceId: string | null): PlanType {
  if (!priceId) return 'free';

  for (const [tier, plan] of Object.entries(SUBSCRIPTION_PLANS)) {
    if (plan.priceId === priceId) {
      return tier as PlanType;
    }
  }
  return 'free';
}

function mapStripeStatus(status: string): SubscriptionStatus {
  const statusMap: Record<string, SubscriptionStatus> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
    incomplete: 'incomplete',
    incomplete_expired: 'incomplete_expired',
    unpaid: 'past_due',
  };
  return statusMap[status] || 'active';
}

function getSubscriptionLimits(tier: PlanType) {
  const plan = SUBSCRIPTION_PLANS[tier];
  return plan?.limits || SUBSCRIPTION_PLANS.free.limits;
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
  const userId = session.metadata?.userId;
  const planId = (session.metadata?.planId as PlanType) || 'free';

  if (!userId) {
    console.error('No userId in checkout session metadata:', session.id);
    return;
  }

  const subscription = session.subscription as Stripe.Subscription;
  if (!subscription) {
    console.error('No subscription in checkout session:', session.id);
    return;
  }

  const priceId = subscription.items.data[0]?.price.id;
  const tier = planId && SUBSCRIPTION_PLANS[planId] ? planId : getPlanTierFromPriceId(priceId);
  const limits = getSubscriptionLimits(tier);

  const updates: Record<string, unknown> = {
    subscription_tier: tier,
    subscription_status: mapStripeStatus(subscription.status),
    subscription_id: subscription.id,
    updated_at: new Date().toISOString(),
    bookmarks_limit: limits.bookmarks,
    collections_limit: limits.collections,
    tags_limit: limits.tags,
  };

  if (session.customer) {
    updates.stripe_customer_id = typeof session.customer === 'string'
      ? session.customer
      : session.customer.id;
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error('Failed to update profile after checkout:', error);
    throw error;
  }

  console.log(`User ${userId} upgraded to ${tier} plan`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) {
    console.error('No customer ID in subscription:', subscription.id);
    return;
  }

  const { data: profiles, error: findError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .limit(1);

  if (findError || profiles.length === 0) {
    console.error('Profile not found for customer:', customerId);
    return;
  }

  const profile = profiles[0];
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getPlanTierFromPriceId(priceId);
  const limits = getSubscriptionLimits(tier);

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: tier,
      subscription_status: mapStripeStatus(subscription.status),
      subscription_id: subscription.id,
      updated_at: new Date().toISOString(),
      bookmarks_limit: limits.bookmarks,
      collections_limit: limits.collections,
      tags_limit: limits.tags,
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Failed to update subscription:', error);
    throw error;
  }

  console.log(`Subscription updated for user ${profile.id}: ${tier} (${subscription.status})`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer?.id;

  if (!customerId) {
    console.error('No customer ID in subscription:', subscription.id);
    return;
  }

  const { data: profiles, error: findError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .limit(1);

  if (findError || profiles.length === 0) {
    console.error('Profile not found for customer:', customerId);
    return;
  }

  const profile = profiles[0];

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      subscription_tier: 'free',
      subscription_status: 'canceled',
      subscription_id: null,
      updated_at: new Date().toISOString(),
      bookmarks_limit: SUBSCRIPTION_PLANS.free.limits.bookmarks,
      collections_limit: SUBSCRIPTION_PLANS.free.limits.collections,
      tags_limit: SUBSCRIPTION_PLANS.free.limits.tags,
    })
    .eq('id', profile.id);

  if (error) {
    console.error('Failed to cancel subscription:', error);
    throw error;
  }

  console.log(`Subscription canceled for user ${profile.id}`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) {
    return;
  }

  const { data: profiles, error: findError } = await supabaseAdmin
    .from('profiles')
    .select('id, subscription_status')
    .eq('stripe_customer_id', customerId)
    .limit(1);

  if (findError || profiles.length === 0) {
    return;
  }

  const profile = profiles[0];

  if (profile.subscription_status === 'past_due') {
    await supabaseAdmin
      .from('profiles')
      .update({
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    console.log(`Payment recovered for user ${profile.id}`);
  }
}

async function handleInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
  const customerId = typeof invoice.customer === 'string'
    ? invoice.customer
    : invoice.customer?.id;

  if (!customerId) {
    return;
  }

  const { data: profiles, error: findError } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .eq('stripe_customer_id', customerId)
    .limit(1);

  if (findError || profiles.length === 0) {
    return;
  }

  const profile = profiles[0];

  await supabaseAdmin
    .from('profiles')
    .update({
      subscription_status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id);

  console.log(`Payment failed for user ${profile.id}, status set to past_due`);
}
