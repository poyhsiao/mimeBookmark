import { NextRequest, NextResponse } from 'next/server';
import { getRecommendationEngine } from '@/lib/recommendations/rule-engine';
import { createClient } from '@/lib/supabase/server';
import { parseValidDate } from '@/lib/utils/sql-escape';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = parseValidDate(startDateStr);
    const endDate = parseValidDate(endDateStr);

    if (startDateStr && !startDate) {
      return NextResponse.json({ error: 'Invalid start date format' }, { status: 400 });
    }

    if (endDateStr && !endDate) {
      return NextResponse.json({ error: 'Invalid end date format' }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (profile.subscription_tier !== 'pro' && profile.subscription_tier !== 'team') {
      return NextResponse.json({
        available: false,
        message: 'Analytics available for Pro and Team plans only',
      });
    }

    const engine = getRecommendationEngine();

    const analytics = await engine.getAnalyticsSummary(startDate, endDate, user.id);

    const { data: topPerformers } = await supabase
      .from('recommendation_analytics')
      .select('rule_id, event_type, revenue_cents')
      .eq('user_id', user.id)
      .gte('created_at', startDate?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', endDate?.toISOString() || new Date().toISOString());

    const rulePerformance: Record<string, { clicks: number; conversions: number; revenue: number }> = {};
    for (const entry of topPerformers || []) {
      if (!rulePerformance[entry.rule_id]) {
        rulePerformance[entry.rule_id] = { clicks: 0, conversions: 0, revenue: 0 };
      }
      if (entry.event_type === 'click') {
        rulePerformance[entry.rule_id].clicks += 1;
      } else if (entry.event_type === 'conversion') {
        rulePerformance[entry.rule_id].conversions += 1;
        rulePerformance[entry.rule_id].revenue += (entry.revenue_cents || 0);
      }
    }

    const uniqueRuleIds = Object.keys(rulePerformance);

    const rulesData: Array<{ id: string; name: string; priority: number; is_active: boolean }> = [];
    if (uniqueRuleIds.length > 0) {
      const { data, error } = await supabase
        .from('recommendation_rules')
        .select('id, name, priority, is_active')
        .in('id', uniqueRuleIds);

      if (error) {
        console.error('Error fetching recommendation rules:', error);
      } else if (data) {
        for (const item of data) {
          rulesData.push({
            id: item.id,
            name: item.name,
            priority: item.priority,
            is_active: item.is_active
          });
        }
      }
    }

    const ruleNameMap = new Map(
      rulesData.map(r => [r.id, r.name])
    );

    const performanceByRule = Object.entries(rulePerformance).map(([ruleId, stats]) => ({
      ruleId,
      ruleName: ruleNameMap.get(ruleId) || ruleId,
      ...stats,
    })).sort((a, b) => b.clicks - a.clicks);

    return NextResponse.json({
      available: true,
      summary: analytics,
      topPerformingRules: performanceByRule.slice(0, 5),
      period: {
        start: (startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).toISOString(),
        end: (endDate || new Date()).toISOString(),
      },
    });
  } catch (error) {
    console.error('Recommendation analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
