import type { SubscriptionPlan, PlanType } from '@/types/subscription';

// Stripe price ID validation pattern
const STRIPE_PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/;

// Validate Stripe price ID format
function validatePriceId(priceId: string | undefined, planName: string): string {
  if (!priceId) {
    throw new Error(
      `Missing required environment variable for ${planName} plan price ID. ` +
      `Please set STRIPE_PRICE_PRO (for Pro) or STRIPE_PRICE_TEAM (for Team) with a valid Stripe price ID.`
    );
  }

  if (!STRIPE_PRICE_ID_PATTERN.test(priceId)) {
    throw new Error(
      `Invalid Stripe price ID format for ${planName}: "${priceId}". ` +
      `Price IDs must start with "price_" followed by alphanumeric characters (e.g., "price_1234567890abcdef").`
    );
  }

  return priceId;
}

// Lazy validation getters for Stripe price IDs
let _STRIPE_PRICE_PRO: string | null = null;
let _STRIPE_PRICE_TEAM: string | null = null;

function getStripePricePro(): string {
  if (_STRIPE_PRICE_PRO === null) {
    _STRIPE_PRICE_PRO = validatePriceId(process.env.STRIPE_PRICE_PRO, 'Pro');
  }
  return _STRIPE_PRICE_PRO;
}

function getStripePriceTeam(): string {
  if (_STRIPE_PRICE_TEAM === null) {
    _STRIPE_PRICE_TEAM = validatePriceId(process.env.STRIPE_PRICE_TEAM, 'Team');
  }
  return _STRIPE_PRICE_TEAM;
}

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
    get priceId() {
      return getStripePricePro();
    },
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
    get priceId() {
      return getStripePriceTeam();
    },
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
