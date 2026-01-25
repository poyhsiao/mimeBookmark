import { NextRequest, NextResponse } from 'next/server';
import { getRecommendationEngine } from '@/lib/recommendations/rule-engine';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const contextParam = searchParams.get('context');
  const allowedContexts = ['sidebar', 'search', 'notification', 'bookmark_added', 'collection_view'] as const;
  const context = (contextParam && allowedContexts.includes(contextParam as any))
    ? contextParam as 'sidebar' | 'search' | 'notification' | 'bookmark_added' | 'collection_view'
    : 'sidebar';
  const query = searchParams.get('query');

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, bookmarks_count')
      .eq('id', user.id)
      .maybeSingle();

    // Handle profile not found or error
    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    if (!profile) {
      console.error('Profile not found for user:', user.id);
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const { data: tags } = await supabase
      .from('tags')
      .select('name')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const engine = getRecommendationEngine();

    const recommendationContext = {
      userId: user.id,
      userTier: (profile?.subscription_tier as 'free' | 'pro' | 'team') || 'free',
      context,
      userBookmarksCount: profile?.bookmarks_count || 0,
      userTagNames: tags?.map(t => t.name) || [],
      userPreferences: query ? { searchQuery: query } : undefined,
    };

    const results = await engine.getRecommendations(recommendationContext);

    const recommendations = results.map(result => ({
      ruleId: result.rule.id,
      ruleName: result.rule.name,
      score: result.score,
      reason: result.reason,
      recommendation: {
        type: result.recommendation.type,
        url: result.recommendation.url,
        title: result.recommendation.title,
        description: result.recommendation.description,
        ctaText: result.recommendation.ctaText,
      },
    }));

    return NextResponse.json({
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error('User recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}

// Track recommendation events
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { ruleId, eventType, revenueCents: rawRevenueCents = 0 } = body;

    if (typeof ruleId !== 'string' || typeof eventType !== 'string') {
      return NextResponse.json({ error: 'Invalid ruleId or eventType type' }, { status: 400 });
    }

    if (!ruleId || !eventType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['impression', 'click', 'dismiss', 'conversion'].includes(eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    // Validate revenueCents
    const revenueCents = Number(rawRevenueCents);
    if (!Number.isFinite(revenueCents) || revenueCents < 0) {
      return NextResponse.json({ error: 'Invalid revenueCents' }, { status: 400 });
    }

    const engine = getRecommendationEngine();
    await engine.trackEvent(ruleId, user.id, eventType, revenueCents);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track event error:', error);
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    );
  }
}
