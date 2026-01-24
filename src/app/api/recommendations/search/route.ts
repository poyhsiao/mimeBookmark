import { NextRequest, NextResponse } from 'next/server';
import { getRecommendationEngine } from '@/lib/recommendations/rule-engine';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    if (!query || query.length < 2) {
      return NextResponse.json({ query: query || '', recommendations: [], count: 0 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier, bookmarks_count')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json(
        { error: 'Failed to fetch user profile' },
        { status: 500 }
      );
    }

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const { data: tags } = await supabase
      .from('tags')
      .select('name')
      .eq('user_id', user.id)
      .is('deleted_at', null);

    const engine = getRecommendationEngine();

    const context = {
      userId: user.id,
      userTier: (profile?.subscription_tier as 'free' | 'pro' | 'team') || 'free',
      context: 'search' as const,
      userBookmarksCount: profile?.bookmarks_count || 0,
      userTagNames: tags?.map(t => t.name) || [],
      userPreferences: { searchQuery: query },
    };

    const results = await engine.getRecommendations(context);

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
      query,
      recommendations,
      count: recommendations.length,
    });
  } catch (error) {
    console.error('Search recommendations error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recommendations' },
      { status: 500 }
    );
  }
}
