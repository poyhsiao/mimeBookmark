/**
 * Recommendation Rule Engine
 * Evaluates recommendation rules against user context and generates personalized recommendations
 */

import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export type RecommendationRule = {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  is_active: boolean;
  min_tier: 'free' | 'pro' | 'team';
  conditions: RuleConditions;
  recommendations: RuleRecommendation[];
  created_at: string;
  updated_at: string;
};

export type UserRecommendation = {
  id: string;
  user_id: string;
  rule_id: string;
  bookmark_url: string | null;
  title: string | null;
  description: string | null;
  cta_text: string | null;
  is_dismissed: boolean;
  dismissed_at: string | null;
  clicked_at: string | null;
  created_at: string;
  updated_at: string;
};

export interface RuleConditions {
  triggerActions?: string[];
  contexts?: string[];
  minBookmarksCount?: number;
  requiredTags?: string[];
  excludedTags?: string[];
  timeOfDay?: { start: string; end: string };
  daysOfWeek?: number[];
  userSegment?: string[];
}

export interface RuleRecommendation {
  type: 'external_link' | 'featured_collection' | 'promotion' | 'newsletter';
  url?: string;
  title: string;
  description: string;
  ctaText: string;
  impressionsPerUser: number;
  metadata?: Record<string, unknown>;
}

export interface RecommendationContext {
  userId: string;
  userTier: 'free' | 'pro' | 'team';
  context: 'sidebar' | 'search' | 'notification' | 'bookmark_added' | 'collection_view';
  userBookmarksCount: number;
  userTagNames: string[];
  userPreferences?: Record<string, unknown>;
}

export interface EvaluationResult {
  rule: RecommendationRule;
  conditions: RuleConditions;
  recommendation: RuleRecommendation;
  score: number;
  shouldRecommend: boolean;
  reason: string;
}

export interface EngineConfig {
  maxRecommendations: number;
  enableABTesting: boolean;
  defaultContext: string;
}

const DEFAULT_CONFIG: EngineConfig = {
  maxRecommendations: 10,
  enableABTesting: false,
  defaultContext: 'sidebar',
};

async function getSupabaseClient() {
  return await createClient();
}

/**
 * Recommendation Rule Engine Class
 * Handles rule evaluation, matching, and recommendation generation
 */
export class RecommendationRuleEngine {
  private config: EngineConfig;

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get all active rules for a user's tier
   */
  async getActiveRules(userTier: string): Promise<RecommendationRule[]> {
    const supabase = await getSupabaseClient();
    const tierOrder = { free: 0, pro: 1, team: 2 };
    const tierValue = tierOrder[userTier as keyof typeof tierOrder] ?? 0;

    const { data: rules, error } = await supabase
      .from('recommendation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching recommendation rules:', error);
      return [];
    }

    // Filter rules by user's tier
    return (rules || []).filter(rule => {
      const ruleTier = tierOrder[rule.min_tier as keyof typeof tierOrder] ?? 0;
      return ruleTier <= tierValue;
    });
  }

  /**
   * Evaluate a single rule against user context
   * Note: Currently evaluates only the first recommendation per rule.
   * If multiple recommendations per rule are needed, refactor to return EvaluationResult[]
   */
  evaluateRule(rule: RecommendationRule, context: RecommendationContext): EvaluationResult {
    const conditions = rule.conditions;
    // For now, evaluate the first recommendation. If rule has no recommendations, use a default
    const recommendation = rule.recommendations[0] || {
      type: 'promotion' as const,
      title: 'Default',
      description: 'Default recommendation',
      ctaText: 'Learn More',
      impressionsPerUser: 1,
    };
    let score = rule.priority;
    let shouldRecommend = true;
    let reason = 'Rule matches all conditions';

    // Check context
    if (conditions.contexts && conditions.contexts.length > 0) {
      if (!conditions.contexts.includes(context.context)) {
        shouldRecommend = false;
        reason = `Context '${context.context}' not in allowed contexts: ${conditions.contexts.join(', ')}`;
        return { rule, conditions, recommendation, score: 0, shouldRecommend, reason };
      }
      score += 10;
    }

    // Check minimum bookmarks count
    if (conditions.minBookmarksCount !== undefined) {
      if (context.userBookmarksCount < conditions.minBookmarksCount) {
        shouldRecommend = false;
        reason = `User has ${context.userBookmarksCount} bookmarks, rule requires ${conditions.minBookmarksCount}`;
        return { rule, conditions, recommendation, score: 0, shouldRecommend, reason };
      }
      score += Math.min(conditions.minBookmarksCount / 10, 20);
    }

    // Check required tags
    if (conditions.requiredTags && conditions.requiredTags.length > 0) {
      const hasRequiredTag = conditions.requiredTags.some(tag =>
        context.userTagNames.includes(tag)
      );
      if (!hasRequiredTag) {
        shouldRecommend = false;
        reason = `User doesn't have any required tags: ${conditions.requiredTags.join(', ')}`;
        return { rule, conditions, recommendation, score: 0, shouldRecommend, reason };
      }
      score += 15;
    }

    // Check excluded tags
    if (conditions.excludedTags && conditions.excludedTags.length > 0) {
      const hasExcludedTag = conditions.excludedTags.some(tag =>
        context.userTagNames.includes(tag)
      );
      if (hasExcludedTag) {
        shouldRecommend = false;
        reason = `User has excluded tags: ${conditions.excludedTags.join(', ')}`;
        return { rule, conditions, recommendation, score: 0, shouldRecommend, reason };
      }
    }

    // Check time of day constraints (using UTC)
    if (conditions.timeOfDay) {
      const now = new Date();
      const currentTime = now.toISOString().slice(11, 16); // Extract HH:MM in UTC
      const { start, end } = conditions.timeOfDay;

      if (start <= end) {
        if (currentTime < start || currentTime > end) {
          shouldRecommend = false;
          reason = `Current UTC time ${currentTime} outside allowed range ${start}-${end}`;
          return { rule, conditions, recommendation, score: 0, shouldRecommend, reason };
        }
      } else {
        if (currentTime < start && currentTime > end) {
          shouldRecommend = false;
          reason = `Current UTC time ${currentTime} outside allowed range ${start}-${end}`;
          return { rule, conditions, recommendation, score: 0, shouldRecommend, reason };
        }
      }
      score += 5;
    }

    // Check day of week constraints (using UTC)
    if (conditions.daysOfWeek && conditions.daysOfWeek.length > 0) {
      const currentDay = new Date().getUTCDay();
      if (!conditions.daysOfWeek.includes(currentDay)) {
        shouldRecommend = false;
        reason = `UTC Day ${currentDay} not in allowed days: ${conditions.daysOfWeek.join(', ')}`;
        return { rule, conditions, recommendation, score: 0, shouldRecommend, reason };
      }
      score += 5;
    }

    score += this.calculateEngagementScore(context);

    return {
      rule,
      conditions,
      recommendation,
      score: Math.min(score, 200),
      shouldRecommend,
      reason,
    };
  }

  /**
   * Calculate engagement score based on user activity
   */
  private calculateEngagementScore(context: RecommendationContext): number {
    let score = 0;

    const bookmarkScore = Math.min(context.userBookmarksCount / 50 * 30, 30);
    score += bookmarkScore;

    const tagScore = Math.min(context.userTagNames.length / 10 * 15, 15);
    score += tagScore;

    return score;
  }

  /**
   * Get recommendations for a user context
   */
  async getRecommendations(context: RecommendationContext): Promise<EvaluationResult[]> {
    const rules = await this.getActiveRules(context.userTier);
    const results: EvaluationResult[] = [];

    for (const rule of rules) {
      const result = this.evaluateRule(rule, context);
      if (result.shouldRecommend) {
        results.push(result);
      }
    }

    results.sort((a, b) => b.score - a.score);

    return results.slice(0, this.config.maxRecommendations);
  }

  /**
   * Generate and store user recommendations
   */
  async generateUserRecommendations(
    context: RecommendationContext,
    userUrls: Set<string>
  ): Promise<UserRecommendation[]> {
    const results = await this.getRecommendations(context);
    const supabase = await getSupabaseClient();
    const newRecs: Partial<UserRecommendation>[] = [];

    // Get rule IDs from results to check for existing recommendations
    const ruleIds = results.map(r => r.rule.id);

    // Query existing recommendations for this user and these rules
    let existingRecs: Array<{ rule_id: string }> = [];

    if (ruleIds.length > 0) {
      const { data } = await supabase
        .from('user_recommendations')
        .select('rule_id')
        .eq('user_id', context.userId)
        .in('rule_id', ruleIds);

      existingRecs = data || [];
    }

    const existingRuleIds = new Set((existingRecs || []).map(r => r.rule_id));

    for (const result of results) {
      const { recommendation } = result;

      // Skip if URL already exists or rule already has a recommendation for this user
      if ((recommendation.url && userUrls.has(recommendation.url)) || existingRuleIds.has(result.rule.id)) {
        continue;
      }

      newRecs.push({
        user_id: context.userId,
        rule_id: result.rule.id,
        bookmark_url: recommendation.url,
        title: recommendation.title,
        description: recommendation.description,
        cta_text: recommendation.ctaText,
      });
    }

    if (newRecs.length === 0) {
      return [];
    }

    // Use correct insert type (omit auto-generated fields)
    type NewUserRecommendation = Omit<UserRecommendation, 'id' | 'is_dismissed' | 'dismissed_at' | 'clicked_at' | 'created_at' | 'updated_at'>;

    const { data: inserted, error } = await supabase
      .from('user_recommendations')
      .insert(newRecs as NewUserRecommendation[])
      .select();

    if (error) {
      console.error('Error inserting user recommendations:', error);
      return [];
    }

    return inserted || [];
  }

  /**
   * Track recommendation analytics event
   */
  async trackEvent(
    ruleId: string,
    userId: string,
    eventType: 'impression' | 'click' | 'dismiss' | 'conversion',
    revenueCents: number = 0
  ): Promise<void> {
    const supabase = await getSupabaseClient();

    // Sanitize userId for production logging (mask PII)
    const isProduction = process.env.NODE_ENV === 'production';
    const sanitizedUserId = isProduction
      ? `${userId.slice(0, 8)}...` // Show only first 8 chars
      : userId;

    // Log before analytics insert for debugging/reconciliation
    console.log('[trackEvent] Starting event tracking:', {
      rule_id: ruleId,
      user_id: sanitizedUserId,
      event_type: eventType,
      revenue_cents: revenueCents,
      timestamp: new Date().toISOString(),
    });

    // Use atomic RPC function to insert analytics and update user_recommendations in a single transaction
    const { error } = await supabase.rpc('track_recommendation_event', {
      p_rule_id: ruleId,
      p_user_id: userId,
      p_event_type: eventType,
      p_revenue_cents: revenueCents,
      p_metadata: {},
    });

    if (error) {
      console.error('[trackEvent] Failed to track event via RPC:', {
        rule_id: ruleId,
        user_id: sanitizedUserId,
        event_type: eventType,
        revenue_cents: revenueCents,
        error: error.message,
      });
      throw new Error(`Failed to track recommendation event: ${error.message}`);
    }

    console.log('[trackEvent] Event tracked successfully (atomic):', {
      rule_id: ruleId,
      user_id: sanitizedUserId,
      event_type: eventType,
    });
  }

  /**
   * Get recommendation analytics summary
   */
  async getAnalyticsSummary(startDate?: Date, endDate?: Date, userId?: string): Promise<{
    totalImpressions: number;
    totalClicks: number;
    totalDismissals: number;
    totalConversions: number;
    totalRevenue: number;
    clickThroughRate: number;
    conversionRate: number;
  }> {
    const supabase = await getSupabaseClient();
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    let query = supabase
      .from('recommendation_analytics')
      .select('event_type, revenue_cents')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString());

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: analytics, error } = await query;

    if (error) {
      console.error('Error fetching analytics:', error);
      return {
        totalImpressions: 0,
        totalClicks: 0,
        totalDismissals: 0,
        totalConversions: 0,
        totalRevenue: 0,
        clickThroughRate: 0,
        conversionRate: 0,
      };
    }

    const stats = {
      totalImpressions: 0,
      totalClicks: 0,
      totalDismissals: 0,
      totalConversions: 0,
      totalRevenue: 0,
      clickThroughRate: 0,
      conversionRate: 0,
    };

    for (const entry of analytics || []) {
      switch (entry.event_type) {
        case 'impression':
          stats.totalImpressions++;
          break;
        case 'click':
          stats.totalClicks++;
          break;
        case 'dismiss':
          stats.totalDismissals++;
          break;
        case 'conversion':
          stats.totalConversions++;
          stats.totalRevenue += entry.revenue_cents || 0;
          break;
      }
    }

    if (stats.totalImpressions > 0) {
      stats.clickThroughRate = (stats.totalClicks / stats.totalImpressions) * 100;
      stats.conversionRate = (stats.totalConversions / stats.totalImpressions) * 100;
    }

    return stats;
  }
}

let engineInstance: RecommendationRuleEngine | null = null;

export function getRecommendationEngine(config?: Partial<EngineConfig>): RecommendationRuleEngine {
  if (!engineInstance) {
    engineInstance = new RecommendationRuleEngine(config);
  } else if (config && Object.keys(config).length > 0) {
    console.warn('[RecommendationEngine] Config parameter ignored - singleton instance already exists. Create a new instance directly if config changes are needed.');
  }
  return engineInstance;
}
