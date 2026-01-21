import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const parsedLimit = parseInt(searchParams.get('limit') || '10', 10);
    const limit = isNaN(parsedLimit) ? 10 : Math.max(1, Math.min(parsedLimit, 100));
    const context = searchParams.get('context') || 'sidebar';

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, preferences')
      .eq('id', user.id)
      .single();

    const tier = profile?.subscription_tier || 'free';

    // Fetch user's existing bookmark URLs to avoid duplicate recommendations
    const { data: userBookmarks } = await supabase
      .from('bookmarks')
      .select('url')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const userUrls = new Set((userBookmarks || []).map(b => b.url).filter(Boolean));

    const { data: userTags } = await supabase
      .from('tags')
      .select('name')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(20);

    const userTagNames = userTags?.map(t => t.name) || [];

    const { data: rules } = await supabase
      .from('recommendation_rules')
      .select('*')
      .eq('is_active', true)
      .order('priority', { ascending: false });

    const tierOrder = { free: 0, pro: 1, team: 2 };

    // Validate user tier and fallback to 'free' if unrecognized
    // Fallback behavior: unknown tiers are treated as 'free' (tier 0) for safety
    let currentTierValue: number;
    if (!Object.prototype.hasOwnProperty.call(tierOrder, tier)) {
      console.warn(
        `Unknown subscription_tier "${tier}" for user ${user.id}, ` +
        `falling back to 'free' tier for recommendation filtering`
      );
      currentTierValue = 0; // Treat unknown tier as 'free'
    } else {
      currentTierValue = tierOrder[tier as keyof typeof tierOrder];
    }

    const applicableRules = rules?.filter(rule => {
      // Skip rules with unrecognized min_tier values
      if (!Object.prototype.hasOwnProperty.call(tierOrder, rule.min_tier)) {
        console.warn(`Unknown min_tier "${rule.min_tier}" for rule ${rule.id}, skipping rule`);
        return false;
      }

      const minTier = tierOrder[rule.min_tier as keyof typeof tierOrder];
      return minTier <= currentTierValue;
    }) || [];

    // Pre-fetch all user recommendations to avoid N+1 queries
    const { data: allUserRecs } = await supabase
      .from('user_recommendations')
      .select('*')
      .eq('user_id', user.id);

    const dismissedRuleIds = new Set(
      (allUserRecs || [])
        .filter(rec => rec.is_dismissed === true)
        .map(rec => rec.rule_id)
    );

    const existingRecsByRuleId = new Map(
      (allUserRecs || [])
        .filter(rec => {
          // TODO: Investigate why clicked_at can be the string 'null' from DB/serialization
          // and fix at source (schema, type conversion, or API serialization layer)

          // Normalize clicked_at: treat string 'null' as actual null
          if (rec.clicked_at === 'null') {
            rec.clicked_at = null;
          }

          const isNotDismissed = rec.is_dismissed === false;
          const isNotClicked = rec.clicked_at == null; // Using == null to catch both null and undefined
          return isNotDismissed && isNotClicked;
        })
        .map(rec => [rec.rule_id, rec])
    );

    const recommendations = [];
    const newRecsToInsert = [];

    for (const rule of applicableRules) {
      const conditions = rule.conditions as {
        triggerActions?: string[];
        contexts?: string[];
        minBookmarksCount?: number;
        requiredTags?: string[];
        excludedTags?: string[];
      };

      if (conditions.contexts && !conditions.contexts.includes(context)) {
        continue;
      }

      if (conditions.requiredTags && conditions.requiredTags.length > 0) {
        const hasRequiredTag = conditions.requiredTags.some(tag => userTagNames.includes(tag));
        if (!hasRequiredTag) {
          continue;
        }
      }

      if (conditions.excludedTags && conditions.excludedTags.length > 0) {
        const hasExcludedTag = conditions.excludedTags.some(tag => userTagNames.includes(tag));
        if (hasExcludedTag) {
          continue;
        }
      }

      const recContent = rule.recommendations as {
        url?: string;
        title: string;
        description: string;
        ctaText: string;
        type: string;
        impressionsPerUser: number;
      };

      if (recContent.url && userUrls.has(recContent.url)) {
        continue;
      }

      // Check pre-fetched dismissed rules
      if (dismissedRuleIds.has(rule.id)) {
        continue;
      }

      // Check pre-fetched existing recommendations
      const existingRec = existingRecsByRuleId.get(rule.id);
      if (existingRec) {
        recommendations.push(existingRec);
      } else {
        // Collect for batch insert
        newRecsToInsert.push({
          user_id: user.id,
          rule_id: rule.id,
          bookmark_url: recContent.url,
          title: recContent.title,
          description: recContent.description,
          cta_text: recContent.ctaText
        });
      }

      if (recommendations.length + newRecsToInsert.length >= limit) {
        break;
      }
    }

    // Batch insert new recommendations
    if (newRecsToInsert.length > 0) {
      const { data: insertedRecs, error } = await supabase
        .from('user_recommendations')
        .insert(newRecsToInsert)
        .select();

      if (error) {
        console.error('Batch insert user_recommendations error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }

      if (insertedRecs) {
        recommendations.push(...insertedRecs);
      }
    }

    return NextResponse.json({
      recommendations: recommendations.slice(0, limit),
      tier
    });
  } catch (error) {
    console.error('User recommendations GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
