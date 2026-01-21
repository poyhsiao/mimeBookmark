import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    // Require authentication and get user's tier from profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const tier = profile?.subscription_tier || 'free';

    let query = supabase
      .from('recommendation_rules')
      .select('*')
      .order('priority', { ascending: false });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data: rules, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tierOrder = { free: 0, pro: 1, team: 2 };
    const filteredRules = rules?.filter(rule => {
      const ruleLevel = tierOrder[rule.min_tier as keyof typeof tierOrder] ?? Infinity;
      const userLevel = tierOrder[tier as keyof typeof tierOrder] ?? -Infinity;
      return ruleLevel <= userLevel;
    });

    return NextResponse.json({ rules: filteredRules });
  } catch (error) {
    console.error('Recommendation rules GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (profile?.subscription_tier !== 'team' && user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - team subscription or admin access required' }, { status: 403 });
    }

    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { name, description, conditions, recommendations, priority, min_tier, is_active } = body;

    if (!name || !conditions || !recommendations) {
      return NextResponse.json({ error: 'Name, conditions, and recommendations are required' }, { status: 400 });
    }

    const { data: rule, error } = await supabase
      .from('recommendation_rules')
      .insert({
        name,
        description,
        conditions,
        recommendations,
        priority: priority || 0,
        min_tier: min_tier || 'free',
        is_active: is_active !== false
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Recommendation rules POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
