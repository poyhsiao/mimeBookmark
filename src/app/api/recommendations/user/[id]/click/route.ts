import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: recommendationId } = await params;

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: updatedRows, error } = await supabase
      .from('user_recommendations')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', recommendationId)
      .eq('user_id', user.id)
      .select('id');

    if (error) {
      console.error('Failed to update recommendation click:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }

    const { data: recommendation } = await supabase
      .from('user_recommendations')
      .select('bookmark_url, rule_id')
      .eq('id', recommendationId)
      .eq('user_id', user.id)
      .single();

    if (recommendation?.bookmark_url) {
      const { error: analyticsError } = await supabase.from('analytics_events').insert({
        user_id: user.id,
        event_name: 'recommendation.click',
        event_data: { recommendation_id: recommendationId, rule_id: recommendation.rule_id, url: recommendation.bookmark_url },
        url: recommendation.bookmark_url
      });
      if (analyticsError) {
        console.error('Failed to log recommendation click event:', analyticsError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recommendation click error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
