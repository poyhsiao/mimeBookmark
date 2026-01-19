import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY environment variable. Please set STRIPE_SECRET_KEY in your environment.'
  );
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2025-05-28.basil' as any,
  typescript: true,
});

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  return key;
}

export function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }
  return secret;
}

export async function createCheckoutSession(
  params: {
    priceId: string;
    customerId?: string;
    successUrl: string;
    cancelUrl: string;
    mode?: 'payment' | 'subscription' | 'setup';
    customerEmail?: string;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: params.mode || 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: params.priceId,
        quantity: 1,
      },
    ],
    customer: params.customerId,
    customer_email: params.customerId ? undefined : params.customerEmail,
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata,
    },
  });

  return session;
}

export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

export async function createOrRetrieveCustomer(
  email: string,
  params?: {
    name?: string;
    metadata?: Record<string, string>;
  }
): Promise<Stripe.Customer> {
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  const customer = await stripe.customers.create({
    email,
    name: params?.name,
    metadata: params?.metadata,
  });

  return customer;
}

export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return null;
    }
    return customer as Stripe.Customer;
  } catch {
    return null;
  }
}

export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
): Promise<Stripe.Subscription> {
  if (cancelAtPeriodEnd) {
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
  return await stripe.subscriptions.cancel(subscriptionId);
}

export async function updateSubscription(
  subscriptionId: string,
  params: {
    priceId?: string;
    quantity?: number;
  }
): Promise<Stripe.Subscription> {
  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: (await stripe.subscriptions.retrieve(subscriptionId)).items.data[0].id,
        price: params.priceId,
        quantity: params.quantity,
      },
    ],
    proration_behavior: 'create_prorations',
  });
}
