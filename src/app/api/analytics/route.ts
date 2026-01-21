import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const endDate = searchParams.get('endDate') || new Date().toISOString();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const isAdmin = profile?.subscription_tier === 'team' || user.user_metadata?.role === 'admin';

    if (isAdmin) {
      // SAFETY NOTE: Client-side aggregation with .limit() safety caps
      // TODO: Replace with Supabase RPC functions using SQL GROUP BY for production scale
      const SAFETY_LIMIT = 10000; // Safety cap to prevent OOM

      // Get total page views count
      const { count: totalPageViews } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get total non-page-view events count
      const { count: totalEvents } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .neq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // Get unique visitors count (distinct session_ids for page views)
      // Safety cap applied to prevent OOM
      const { data: uniqueSessionsData } = await supabase
        .from('analytics_events')
        .select('session_id')
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      const uniqueVisitors = new Set(uniqueSessionsData?.map(e => e.session_id) || []).size;
      const sessionLimitReached = (uniqueSessionsData?.length || 0) >= SAFETY_LIMIT;

      // Get top events (aggregated by event_name, excluding page_view)
      // Safety cap applied to prevent OOM
      const { data: eventAggData } = await supabase
        .from('analytics_events')
        .select('event_name')
        .neq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      const eventCounts: Record<string, number> = {};
      eventAggData?.forEach(e => {
        eventCounts[e.event_name] = (eventCounts[e.event_name] || 0) + 1;
      });

      const topEvents = Object.entries(eventCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Get top pages (aggregated by url for page_view events)
      // Safety cap applied to prevent OOM
      const { data: pageAggData } = await supabase
        .from('analytics_events')
        .select('url')
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      const pageCounts: Record<string, number> = {};
      pageAggData?.forEach(e => {
        if (e.url) {
          pageCounts[e.url] = (pageCounts[e.url] || 0) + 1;
        }
      });

      const topPages = Object.entries(pageCounts)
        .map(([url, views]) => ({ url, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

      // Get daily views (aggregated by date for page_view events)
      // Safety cap applied to prevent OOM
      const { data: dailyAggData } = await supabase
        .from('analytics_events')
        .select('created_at')
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      const dailyCounts: Record<string, number> = {};
      dailyAggData?.forEach(e => {
        if (e.created_at && typeof e.created_at === 'string') {
          const date = e.created_at.split('T')[0];
          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        }
      });

      const dailyViews = Object.entries(dailyCounts)
        .map(([date, views]) => ({ date, views }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return NextResponse.json({
        totalPageViews: totalPageViews || 0,
        totalEvents: totalEvents || 0,
        uniqueVisitors,
        sessionLimitReached,
        topEvents,
        topPages,
        dailyViews,
        isAdmin: true
      });
    } else {
      const [{ count: bookmarksCount }, { count: collectionsCount }, { count: tagsCount }, { count: searchesCount }, { count: importsCount }, { count: exportsCount }] = await Promise.all([
        supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
        supabase.from('collections').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
        supabase.from('tags').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
        supabase.from('search_history').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate),
        supabase.from('import_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate),
        supabase.from('export_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate)
      ]);

      return NextResponse.json({
        totalBookmarks: bookmarksCount || 0,
        totalCollections: collectionsCount || 0,
        totalTags: tagsCount || 0,
        totalSearches: searchesCount || 0,
        totalImports: importsCount || 0,
        totalExports: exportsCount || 0,
        isAdmin: false
      });
    }
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
