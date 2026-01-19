export type PlanType = 'free' | 'pro' | 'team';

export type SubscriptionStatus =
  | 'active'
  | 'canceled'
  | 'past_due'
  | 'trialing'
  | 'incomplete'
  | 'incomplete_expired'
  | 'unpaid';

export interface SubscriptionPlan {
  id: PlanType;
  name: string;
  price: number;
  priceId: string | null;
  features: string[];
  limits: {
    bookmarks: number;
    collections: number;
    tags: number;
    teamMembers?: number;
  };
}

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  stripeCustomerId: string | null;
  subscriptionId: string | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionTier: PlanType | null;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  customerId: string;
  status: SubscriptionStatus;
  tier: PlanType;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
  quantity: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCheckoutSessionParams {
  planId: PlanType;
  successUrl: string;
  cancelUrl: string;
}

export interface CreatePortalSessionParams {
  customerId: string;
  returnUrl: string;
}

export interface WebhookEvent {
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}
