import { describe, expect, test, vi, beforeEach } from 'vitest';
import { RecommendationRuleEngine, getRecommendationEngine } from '../rule-engine';
import type { RecommendationContext, RuleConditions, RuleRecommendation } from '../rule-engine';

const mockSupabase = {
  from: vi.fn(),
  auth: {
    getUser: vi.fn(),
  },
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('RecommendationRuleEngine', () => {
  const mockUserId = 'user-123';
  const mockUserTier: 'free' | 'pro' | 'team' = 'pro';

  function createMockRule(overrides: Partial<{
    id: string;
    name: string;
    description: string;
    priority: number;
    is_active: boolean;
    min_tier: 'free' | 'pro' | 'team';
    conditions: RuleConditions;
    recommendations: RuleRecommendation[];
  }> = {}): {
    id: string;
    name: string;
    description: string;
    priority: number;
    is_active: boolean;
    min_tier: 'free' | 'pro' | 'team';
    conditions: RuleConditions;
    recommendations: RuleRecommendation[];
    created_at: string;
    updated_at: string;
  } {
    return {
      id: 'rule-1',
      name: 'Test Rule',
      description: 'Test description',
      priority: 50,
      is_active: true,
      min_tier: 'free',
      conditions: {},
      recommendations: [{
        type: 'external_link',
        title: 'Test Recommendation',
        description: 'Test description',
        ctaText: 'Click here',
        impressionsPerUser: 1,
      }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  function createContext(overrides: Partial<RecommendationContext> = {}): RecommendationContext {
    return {
      userId: mockUserId,
      userTier: mockUserTier,
      context: 'sidebar',
      userBookmarksCount: 100,
      userTagNames: ['javascript', 'react', 'typescript'],
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveRules', () => {
    test('should return active rules for user tier', async () => {
      const mockRules = [
        { id: 'rule-free', min_tier: 'free', priority: 30, is_active: true },
        { id: 'rule-pro', min_tier: 'pro', priority: 60, is_active: true },
        { id: 'rule-team', min_tier: 'team', priority: 90, is_active: true },
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'recommendation_rules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: mockRules,
              error: null,
            }),
          };
        }
        return {};
      });

      const engine = getRecommendationEngine();
      const rules = await engine.getActiveRules('pro');

      // Pro user can see free (0) and pro (1) rules, but not team (2) rules
      expect(rules).toHaveLength(2);
      expect(rules.find(r => r.id === 'rule-pro')).toBeDefined();
      expect(rules.find(r => r.id === 'rule-free')).toBeDefined();
    });

    test('should filter rules by tier correctly', async () => {
      const mockRules = [
        createMockRule({ id: 'rule-free', min_tier: 'free' }),
        createMockRule({ id: 'rule-pro', min_tier: 'pro' }),
        createMockRule({ id: 'rule-team', min_tier: 'team' }),
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'recommendation_rules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
          };
        }
        return {};
      });

      const engine = getRecommendationEngine();

      const freeRules = await engine.getActiveRules('free');
      expect(freeRules).toHaveLength(1);
      expect(freeRules[0].id).toBe('rule-free');

      const proRules = await engine.getActiveRules('pro');
      expect(proRules).toHaveLength(2);

      const teamRules = await engine.getActiveRules('team');
      expect(teamRules).toHaveLength(3);
    });

    test('should return empty array on error', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'recommendation_rules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Database error' } }),
          };
        }
        return {};
      });

      const engine = getRecommendationEngine();
      const rules = await engine.getActiveRules('free');

      expect(rules).toEqual([]);
    });
  });

  describe('evaluateRule', () => {
    test('should accept rule with matching context', () => {
      const rule = createMockRule({
        conditions: { contexts: ['sidebar', 'search'] },
      });
      const context = createContext({ context: 'sidebar' });

      const engine = getRecommendationEngine();
      const result = engine.evaluateRule(rule, context);

      expect(result.shouldRecommend).toBe(true);
      expect(result.score).toBeGreaterThan(0);
    });

    test('should reject rule with non-matching context', () => {
      const rule = createMockRule({
        conditions: { contexts: ['notification'] },
      });
      const context = createContext({ context: 'sidebar' });

      const engine = getRecommendationEngine();
      const result = engine.evaluateRule(rule, context);

      expect(result.shouldRecommend).toBe(false);
      expect(result.score).toBe(0);
    });

    test('should check minimum bookmarks count', () => {
      const rule = createMockRule({
        conditions: { minBookmarksCount: 50 },
      });

      const engine = getRecommendationEngine();

      const belowMin = engine.evaluateRule(rule, createContext({ userBookmarksCount: 30 }));
      expect(belowMin.shouldRecommend).toBe(false);

      const meetsMin = engine.evaluateRule(rule, createContext({ userBookmarksCount: 100 }));
      expect(meetsMin.shouldRecommend).toBe(true);
    });

    test('should check required tags', () => {
      const rule = createMockRule({
        conditions: { requiredTags: ['react', 'typescript'] },
      });

      const engine = getRecommendationEngine();

      const missingTags = engine.evaluateRule(rule, createContext({ userTagNames: ['javascript'] }));
      expect(missingTags.shouldRecommend).toBe(false);

      const hasTags = engine.evaluateRule(rule, createContext({ userTagNames: ['react', 'typescript'] }));
      expect(hasTags.shouldRecommend).toBe(true);
    });

    test('should check excluded tags', () => {
      const rule = createMockRule({
        conditions: { excludedTags: ['archived', 'old'] },
      });

      const engine = getRecommendationEngine();

      const hasExcluded = engine.evaluateRule(rule, createContext({ userTagNames: ['javascript', 'archived'] }));
      expect(hasExcluded.shouldRecommend).toBe(false);

      const noExcluded = engine.evaluateRule(rule, createContext({ userTagNames: ['javascript', 'react'] }));
      expect(noExcluded.shouldRecommend).toBe(true);
    });

    test('should check time of day constraints', () => {
      // Use fake timers to make test deterministic
      vi.useFakeTimers();

      // Set a known time: 10:30 UTC
      vi.setSystemTime(new Date('2024-01-15T10:30:00Z'));

      // Create rule that matches this time window
      const ruleMatching = createMockRule({
        conditions: { timeOfDay: { start: '10:00', end: '11:00' } },
      });

      // Create rule that doesn't match
      const ruleNotMatching = createMockRule({
        conditions: { timeOfDay: { start: '14:00', end: '15:00' } },
      });

      const engine = getRecommendationEngine();

      const resultMatching = engine.evaluateRule(ruleMatching, createContext());
      expect(resultMatching.shouldRecommend).toBe(true);
      expect(resultMatching.reason).toContain('Rule matches');

      const resultNotMatching = engine.evaluateRule(ruleNotMatching, createContext());
      expect(resultNotMatching.shouldRecommend).toBe(false);
      expect(resultNotMatching.reason).toContain('Current UTC time');

      // Restore real timers
      vi.useRealTimers();
    });

    test('should check day of week constraints', () => {
      // Use fake timers to make test deterministic
      vi.useFakeTimers();

      // Set a known weekday: Wednesday 2023-01-04 (day 3)
      vi.setSystemTime(new Date('2023-01-04T10:00:00Z'));

      // Create rule that only matches weekends (Saturday=6, Sunday=0)
      const rule = createMockRule({
        conditions: { daysOfWeek: [6, 0] }, // Weekend only
      });

      const engine = getRecommendationEngine();
      const result = engine.evaluateRule(rule, createContext());

      // Wednesday should not match weekend-only rule
      expect(result.shouldRecommend).toBe(false);
      expect(result.reason).toContain('Day');

      // Restore real timers
      vi.useRealTimers();
    });
  });

  describe('getRecommendations', () => {
    test('should return sorted recommendations by score', async () => {
      const mockRules = [
        createMockRule({ id: 'rule-low', priority: 20 }),
        createMockRule({ id: 'rule-high', priority: 80 }),
        createMockRule({ id: 'rule-medium', priority: 50 }),
      ];

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'recommendation_rules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
          };
        }
        return {};
      });

      const engine = getRecommendationEngine();
      const results = await engine.getRecommendations(createContext());

      expect(results.length).toBe(3);
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
      expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
    });

    test('should limit results to maxRecommendations', async () => {
      // Create a fresh engine with custom config
      const mockRules = Array.from({ length: 15 }, (_, i) =>
        createMockRule({ id: `rule-${i}`, priority: 100 - i })
      );

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'recommendation_rules') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockRules, error: null }),
          };
        }
        return {};
      });

      const engine = new RecommendationRuleEngine({ maxRecommendations: 5 });
      const results = await engine.getRecommendations(createContext());

      expect(results).toHaveLength(5);
    });
  });

  describe('getAnalyticsSummary', () => {
    test('should calculate correct rates', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'recommendation_analytics') {
          return {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({
              data: [
                { event_type: 'impression' },
                { event_type: 'impression' },
                { event_type: 'impression' },
                { event_type: 'impression' },
                { event_type: 'click' },
                { event_type: 'click' },
                { event_type: 'dismiss' },
                { event_type: 'conversion', revenue_cents: 500 },
              ],
              error: null,
            }),
          };
        }
        return {};
      });

      const engine = getRecommendationEngine();
      const analytics = await engine.getAnalyticsSummary();

      expect(analytics.totalImpressions).toBe(4);
      expect(analytics.totalClicks).toBe(2);
      expect(analytics.totalDismissals).toBe(1);
      expect(analytics.totalConversions).toBe(1);
      expect(analytics.totalRevenue).toBe(500);
      expect(analytics.clickThroughRate).toBe(50);
    });

    test('should return zeros on error', async () => {
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'recommendation_analytics') {
          return {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockResolvedValue({ data: null, error: { message: 'Error' } }),
          };
        }
        return {};
      });

      const engine = getRecommendationEngine();
      const analytics = await engine.getAnalyticsSummary();

      expect(analytics.totalImpressions).toBe(0);
      expect(analytics.clickThroughRate).toBe(0);
    });
  });

  describe('singleton instance', () => {
    test('should return same instance', () => {
      const engine1 = getRecommendationEngine();
      const engine2 = getRecommendationEngine();

      expect(engine1).toBe(engine2);
    });

    test('should return same instance even if called with different configs', () => {
      const engine1 = getRecommendationEngine({ maxRecommendations: 5 });
      const engine2 = getRecommendationEngine({ maxRecommendations: 10 });

      expect(engine1).toBe(engine2);
    });
  });
});
