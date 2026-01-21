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

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const tier = profile?.subscription_tier ?? 'free';
    const isAdmin = tier === 'team' || user.app_metadata?.role === 'admin';

    if (!isAdmin && tier !== 'pro') {
      return NextResponse.json({ error: 'Forbidden - Pro subscription required for analytics' }, { status: 403 });
    }

    if (isAdmin) {
      // SAFETY NOTE: Client-side aggregation with .limit() safety caps
      // TODO: Replace with Supabase RPC functions using SQL GROUP BY for production scale
      const SAFETY_LIMIT = 10000; // Safety cap to prevent OOM
      let eventsLimitReached = false;
      let pagesLimitReached = false;
      let dailyViewsLimitReached = false;

      // Get total page views count
      const { count: totalPageViews, error: totalPageViewsError } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (totalPageViewsError) {
        return NextResponse.json({ error: totalPageViewsError.message }, { status: 500 });
      }

      // Get total non-page-view events count
      const { count: totalEvents, error: totalEventsError } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true })
        .neq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (totalEventsError) {
        return NextResponse.json({ error: totalEventsError.message }, { status: 500 });
      }

      // Get unique visitors count (distinct session_ids for page views)
      // Safety cap applied to prevent OOM
      const { data: uniqueSessionsData, error: uniqueSessionsError } = await supabase
        .from('analytics_events')
        .select('session_id')
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      if (uniqueSessionsError) {
        return NextResponse.json({ error: uniqueSessionsError.message }, { status: 500 });
      }

      const uniqueVisitors = new Set(uniqueSessionsData?.map(e => e.session_id) || []).size;
      const sessionLimitReached = (uniqueSessionsData?.length || 0) >= SAFETY_LIMIT;

      // Get top events (aggregated by event_name, excluding page_view)
      // Safety cap applied to prevent OOM
      const { data: eventAggData, error: eventAggError } = await supabase
        .from('analytics_events')
        .select('event_name')
        .neq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      if (eventAggError) {
        return NextResponse.json({ error: eventAggError.message }, { status: 500 });
      }

      eventsLimitReached = (eventAggData?.length || 0) >= SAFETY_LIMIT;

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
      const { data: pageAggData, error: pageAggError } = await supabase
        .from('analytics_events')
        .select('url')
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      if (pageAggError) {
        return NextResponse.json({ error: pageAggError.message }, { status: 500 });
      }

      pagesLimitReached = (pageAggData?.length || 0) >= SAFETY_LIMIT;

      // Get daily views (aggregated by date for page_view events)
      // Safety cap applied to prevent OOM
      const { data: dailyAggData, error: dailyAggError } = await supabase
        .from('analytics_events')
        .select('created_at')
        .eq('event_name', 'page_view')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .limit(SAFETY_LIMIT);

      if (dailyAggError) {
        return NextResponse.json({ error: dailyAggError.message }, { status: 500 });
      }

      dailyViewsLimitReached = (dailyAggData?.length || 0) >= SAFETY_LIMIT;

      const pageCounts: Record<string, number> = {};
      pageAggData?.forEach(e => {
        if (e.url) {
          pageCounts[e.url] = (pageCounts[e.url] || 0) + 1;
        }
      });

      const dailyCounts: Record<string, number> = {};
      dailyAggData?.forEach(e => {
        if (e.created_at && typeof e.created_at === 'string') {
          const date = e.created_at.split('T')[0];
          dailyCounts[date] = (dailyCounts[date] || 0) + 1;
        }
      });

      const topPages = Object.entries(pageCounts)
        .map(([url, views]) => ({ url, views }))
        .sort((a, b) => b.views - a.views)
        .slice(0, 10);

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
        eventsLimitReached,
        pagesLimitReached,
        dailyViewsLimitReached,
        isAdmin: true
      });
    } else {
      const [
        bookmarksRes,
        collectionsRes,
        tagsRes,
        searchesRes,
        importsRes,
        exportsRes
      ] = await Promise.all([
        supabase.from('bookmarks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
        supabase.from('collections').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
        supabase.from('tags').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
        supabase.from('search_history').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate),
        supabase.from('import_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate),
        supabase.from('export_jobs').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', startDate).lte('created_at', endDate)
      ]);

      const errors = [
        bookmarksRes.error,
        collectionsRes.error,
        tagsRes.error,
        searchesRes.error,
        importsRes.error,
        exportsRes.error
      ].filter(Boolean);

      if (errors.length > 0) {
        return NextResponse.json({ error: errors[0]!.message }, { status: 500 });
      }

      const { count: bookmarksCount } = bookmarksRes;
      const { count: collectionsCount } = collectionsRes;
      const { count: tagsCount } = tagsRes;
      const { count: searchesCount } = searchesRes;
      const { count: importsCount } = importsRes;
      const { count: exportsCount } = exportsRes;

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
