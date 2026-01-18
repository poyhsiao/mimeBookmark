import { describe, expect, test, beforeEach, vi, beforeAll, afterAll } from 'vitest';
import {
  SUBSCRIPTION_PLANS,
  getPlan,
  getPlanByPriceId,
  isProOrHigher,
  isTeamPlan,
  hasUnlimited,
  formatLimit,
} from '../plans';

beforeAll(() => {
  vi.stubEnv('STRIPE_PRICE_PRO', 'price_pro_test');
  vi.stubEnv('STRIPE_PRICE_TEAM', 'price_team_test');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('SUBSCRIPTION_PLANS', () => {

  test('contains free, pro, and team plans', () => {
    expect(SUBSCRIPTION_PLANS.free).toBeDefined();
    expect(SUBSCRIPTION_PLANS.pro).toBeDefined();
    expect(SUBSCRIPTION_PLANS.team).toBeDefined();
  });

  test('free plan has correct limits', () => {
    expect(SUBSCRIPTION_PLANS.free.limits.bookmarks).toBe(100);
    expect(SUBSCRIPTION_PLANS.free.limits.collections).toBe(5);
    expect(SUBSCRIPTION_PLANS.free.limits.tags).toBe(20);
    expect(SUBSCRIPTION_PLANS.free.price).toBe(0);
    expect(SUBSCRIPTION_PLANS.free.priceId).toBeNull();
  });

  test('pro plan has correct limits', () => {
    expect(SUBSCRIPTION_PLANS.pro.limits.bookmarks).toBe(-1);
    expect(SUBSCRIPTION_PLANS.pro.limits.collections).toBe(-1);
    expect(SUBSCRIPTION_PLANS.pro.limits.tags).toBe(-1);
    expect(SUBSCRIPTION_PLANS.pro.price).toBe(5);
    expect(SUBSCRIPTION_PLANS.pro.priceId).toBeTruthy();
  });

  test('team plan has correct limits', () => {
    expect(SUBSCRIPTION_PLANS.team.limits.bookmarks).toBe(-1);
    expect(SUBSCRIPTION_PLANS.team.limits.teamMembers).toBe(10);
    expect(SUBSCRIPTION_PLANS.team.price).toBe(15);
    expect(SUBSCRIPTION_PLANS.team.priceId).toBeTruthy();
  });
});

describe('getPlan', () => {
  test('returns correct plan for valid ID', () => {
    expect(getPlan('free')).toEqual(SUBSCRIPTION_PLANS.free);
    expect(getPlan('pro')).toEqual(SUBSCRIPTION_PLANS.pro);
    expect(getPlan('team')).toEqual(SUBSCRIPTION_PLANS.team);
  });
});

describe('getPlanByPriceId', () => {
  test('returns plan for valid priceId', () => {
    const proPriceId = SUBSCRIPTION_PLANS.pro.priceId;
    expect(proPriceId).not.toBeNull();
    const proPlan = getPlanByPriceId(proPriceId!);
    expect(proPlan).toEqual(SUBSCRIPTION_PLANS.pro);
  });

  test('returns null for invalid priceId', () => {
    const plan = getPlanByPriceId('invalid_price_id');
    expect(plan).toBeNull();
  });
});

describe('isProOrHigher', () => {
  test('returns false for free plan', () => {
    expect(isProOrHigher('free')).toBe(false);
  });

  test('returns true for pro plan', () => {
    expect(isProOrHigher('pro')).toBe(true);
  });

  test('returns true for team plan', () => {
    expect(isProOrHigher('team')).toBe(true);
  });
});

describe('isTeamPlan', () => {
  test('returns false for free plan', () => {
    expect(isTeamPlan('free')).toBe(false);
  });

  test('returns false for pro plan', () => {
    expect(isTeamPlan('pro')).toBe(false);
  });

  test('returns true for team plan', () => {
    expect(isTeamPlan('team')).toBe(true);
  });
});

describe('hasUnlimited', () => {
  test('returns true for -1', () => {
    expect(hasUnlimited(-1)).toBe(true);
  });

  test('returns false for non-negative numbers', () => {
    expect(hasUnlimited(100)).toBe(false);
    expect(hasUnlimited(0)).toBe(false);
  });
});

describe('formatLimit', () => {
  test('formats unlimited as "Unlimited"', () => {
    expect(formatLimit(-1)).toBe('Unlimited');
  });

  test('formats numbers with locale', () => {
    expect(formatLimit(100)).toBe('100');
    expect(formatLimit(1000)).toBe('1,000');
  });
});
