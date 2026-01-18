import Stripe from 'stripe';
import { createHash } from 'crypto';

let stripeInstance: Stripe | null = null;

export const getStripeClient = () => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error(
      'Missing STRIPE_SECRET_KEY environment variable. Please set STRIPE_SECRET_KEY in your environment.'
    );
  }
  if (!stripeInstance) {
    stripeInstance = new Stripe(stripeSecretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return stripeInstance;
};

// Use a proxy or a getter for existing property access
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripeClient() as any)[prop];
  }
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
    clientReferenceId?: string;
  }
): Promise<Stripe.Checkout.Session> {
  const session = await stripe.checkout.sessions.create({
    mode: params.mode || 'subscription',
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
    client_reference_id: params.clientReferenceId,
    metadata: params.metadata,
    ...(params.mode === 'subscription' || !params.mode ? {
      subscription_data: {
        metadata: params.metadata,
      },
    } : {}),
  } as any);

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

  // Use email-based idempotency key to ensure exactly-once customer creation.
  // Note: Stripe returns the original response for repeated requests with the same
  // idempotency key and does NOT apply new name/metadata from subsequent calls.
  // If the customer already exists, we update it with the new parameters.
  //
  // LIMITATION: This permanent idempotency key (based only on email) prevents
  // recreating a customer if one was deleted. To support recreation after deletion,
  // consider adding a variable component (timestamp, UUID, or deletion token) to
  // the idempotency key generation.
  const idempotencyKey = createHash('sha256').update(email).digest('hex');

  try {
    const customer = await stripe.customers.create(
      {
        email,
        name: params?.name,
        metadata: params?.metadata,
      },
      { idempotencyKey }
    );
    return customer;
  } catch (error: any) {
    // Only handle concurrent creation conflicts, rethrow all other errors
    const isIdempotencyError = error?.type === 'idempotency_error';
    const isResourceAlreadyExistsConflict =
      error?.statusCode === 409 || error?.code === 'resource_already_exists';

    if (!isIdempotencyError && !isResourceAlreadyExistsConflict) {
      // Network errors, rate limits, auth failures, etc. should be rethrown
      throw error;
    }

    // If concurrent creation occurred, try to find the customer again
    const fallbackList = await stripe.customers.list({
      email,
      limit: 1,
    });
    if (fallbackList.data.length > 0) {
      const existingCustomer = fallbackList.data[0];
      // Update the customer with new parameters if provided
      if (params?.name || params?.metadata) {
        const updated = await stripe.customers.update(existingCustomer.id, {
          ...(params.name && { name: params.name }),
          ...(params.metadata && { metadata: params.metadata }),
        });
        return updated;
      }
      return existingCustomer;
    }
    throw error;
  }
}

export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return null;
    }
    return customer as Stripe.Customer;
  } catch (err: any) {
    if (err?.statusCode === 404 || err?.code === 'resource_missing') {
      return null;
    }
    console.error('Failed to retrieve Stripe customer:', err);
    throw err;
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
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  if (!subscription.items?.data || subscription.items.data.length === 0) {
    throw new Error(`Subscription ${subscriptionId} has no items`);
  }

  // Validate that this is a single-item subscription
  if (subscription.items.data.length > 1) {
    throw new Error(
      `updateSubscription only supports single-item subscriptions. ` +
      `Subscription ${subscriptionId} has ${subscription.items.data.length} items. ` +
      `Supporting multi-item updates would require mapping params to each item and handling proration_behavior per item.`
    );
  }

  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: params.priceId,
        quantity: params.quantity,
      },
    ],
    proration_behavior: 'create_prorations',
  });
}
