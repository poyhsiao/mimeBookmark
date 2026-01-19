import type { SubscriptionPlan, PlanType } from '@/types/subscription';

export const SUBSCRIPTION_PLANS: Record<PlanType, SubscriptionPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    features: ['Up to 100 bookmarks', '5 collections', 'Basic search'],
    limits: {
      bookmarks: 100,
      collections: 5,
      tags: 20,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 5,
    priceId: process.env.STRIPE_PRICE_PRO || 'price_pro_monthly',
    features: [
      'Unlimited bookmarks',
      'Unlimited collections',
      'Advanced search',
      'Import/Export',
      'Priority support',
    ],
    limits: {
      bookmarks: -1,
      collections: -1,
      tags: -1,
    },
  },
  team: {
    id: 'team',
    name: 'Team',
    price: 15,
    priceId: process.env.STRIPE_PRICE_TEAM || 'price_team_monthly',
    features: [
      'Everything in Pro',
      'Team management',
      'Shared collections',
      'Admin dashboard',
      'API access',
    ],
    limits: {
      bookmarks: -1,
      collections: -1,
      tags: -1,
      teamMembers: 10,
    },
  },
};

export function getPlan(planId: PlanType): SubscriptionPlan {
  return SUBSCRIPTION_PLANS[planId];
}

export function getPlanByPriceId(priceId: string): SubscriptionPlan | null {
  const plan = Object.values(SUBSCRIPTION_PLANS).find(
    (plan) => plan.priceId === priceId
  );
  return plan || null;
}

export function isProOrHigher(currentPlan: PlanType): boolean {
  return currentPlan === 'pro' || currentPlan === 'team';
}

export function isTeamPlan(currentPlan: PlanType): boolean {
  return currentPlan === 'team';
}

export function hasUnlimited(limit: number): boolean {
  return limit === -1;
}

export function formatLimit(limit: number): string {
  if (limit === -1) return 'Unlimited';
  return limit.toLocaleString();
}
