'use client';

import { useEffect, useState } from 'react';
import { useAnalytics } from '@/lib/analytics';
import { usePremiumFeature } from '@/hooks/use-premium-feature';

interface AnalyticsData {
  isAdmin: boolean;
  // Admin metrics
  totalPageViews?: number;
  totalEvents?: number;
  uniqueVisitors?: number;
  topEvents?: Array<{ name: string; count: number }>;
  topPages?: Array<{ url: string; views: number }>;
  dailyViews?: Array<{ date: string; views: number }>;
  // User metrics
  totalBookmarks?: number;
  totalCollections?: number;
  totalTags?: number;
  totalSearches?: number;
  totalImports?: number;
  totalExports?: number;
}

export default function AnalyticsDashboard() {
  const { track } = useAnalytics();
  const { isAllowed, upgrade } = usePremiumFeature({ requiredTier: 'pro', featureKey: 'analytics' });
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState('30');

  useEffect(() => {
    track('page_view', { page: 'analytics' });
  }, [track]);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const endDate = new Date().toISOString();
        const startDate = new Date(Date.now() - parseInt(dateRange) * 24 * 60 * 60 * 1000).toISOString();

        const response = await fetch(`/api/analytics?startDate=${startDate}&endDate=${endDate}`);
        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const analyticsData = await response.json();
        setData(analyticsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [dateRange]);

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold mb-2">Analytics Requires Pro</h2>
          <p className="text-muted-foreground mb-4">Upgrade to Pro to access analytics features.</p>
          <button
            onClick={upgrade}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Error loading analytics</h2>
          <p className="text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Track your usage and engagement metrics</p>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border rounded-lg bg-background"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </div>

      {data?.isAdmin ? (
        data && <AdminAnalyticsView data={data} />
      ) : (
        data && <UserAnalyticsView data={data} />
      )}
    </div>
  );
}

function AdminAnalyticsView({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-card rounded-lg p-6 border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Page Views</h3>
          <p className="text-3xl font-bold mt-2">{data.totalPageViews?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-6 border">
          <h3 className="text-sm font-medium text-muted-foreground">Total Events</h3>
          <p className="text-3xl font-bold mt-2">{data.totalEvents?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-6 border">
          <h3 className="text-sm font-medium text-muted-foreground">Unique Visitors</h3>
          <p className="text-3xl font-bold mt-2">{data.uniqueVisitors?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Views Chart */}
        <div className="bg-card rounded-lg p-6 border">
          <h3 className="text-lg font-semibold mb-4">Daily Page Views</h3>
          <div className="h-64 flex items-end gap-1">
            {data.dailyViews?.map((day, index) => {
              const maxViews = Math.max(1, ...(data.dailyViews?.map(d => d.views) || []));
              const height = (day.views / maxViews) * 100;
              return (
                <div
                  key={day.date}
                  className="flex-1 bg-primary/80 hover:bg-primary transition-colors rounded-t"
                  style={{ height: `${height}%` }}
                  title={`${day.date}: ${day.views} views`}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>{data.dailyViews?.[0]?.date}</span>
            <span>{data.dailyViews?.[data.dailyViews.length - 1]?.date}</span>
          </div>
        </div>

        {/* Top Events */}
        <div className="bg-card rounded-lg p-6 border">
          <h3 className="text-lg font-semibold mb-4">Top Events</h3>
          <div className="space-y-3">
            {data.topEvents?.slice(0, 8).map((event, index) => (
              <div key={event.name} className="flex items-center gap-3">
                <span className="text-sm font-mono w-6">{index + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span>{event.name}</span>
                    <span className="text-muted-foreground">{event.count}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${(event.count / (data.topEvents?.[0]?.count || 1)) * 100}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Pages */}
      <div className="bg-card rounded-lg p-6 border">
        <h3 className="text-lg font-semibold mb-4">Top Pages</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-muted-foreground border-b">
                <th className="pb-2 font-medium">Page</th>
                <th className="pb-2 font-medium text-right">Views</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages?.map((page) => (
                <tr key={page.url} className="border-b last:border-0">
                  <td className="py-3 text-sm font-mono">{page.url}</td>
                  <td className="py-3 text-sm text-right">{page.views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserAnalyticsView({ data }: { data: AnalyticsData }) {
  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-card rounded-lg p-4 border text-center">
          <h3 className="text-xs font-medium text-muted-foreground">Bookmarks</h3>
          <p className="text-2xl font-bold mt-1">{data.totalBookmarks?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border text-center">
          <h3 className="text-xs font-medium text-muted-foreground">Collections</h3>
          <p className="text-2xl font-bold mt-1">{data.totalCollections?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border text-center">
          <h3 className="text-xs font-medium text-muted-foreground">Tags</h3>
          <p className="text-2xl font-bold mt-1">{data.totalTags?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border text-center">
          <h3 className="text-xs font-medium text-muted-foreground">Searches</h3>
          <p className="text-2xl font-bold mt-1">{data.totalSearches?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border text-center">
          <h3 className="text-xs font-medium text-muted-foreground">Imports</h3>
          <p className="text-2xl font-bold mt-1">{data.totalImports?.toLocaleString() || 0}</p>
        </div>
        <div className="bg-card rounded-lg p-4 border text-center">
          <h3 className="text-xs font-medium text-muted-foreground">Exports</h3>
          <p className="text-2xl font-bold mt-1">{data.totalExports?.toLocaleString() || 0}</p>
        </div>
      </div>

      {/* Activity Overview */}
      <div className="bg-card rounded-lg p-6 border">
        <h3 className="text-lg font-semibold mb-4">Your Activity Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Content Summary</h4>
            <p className="text-sm">
              You have <strong>{data.totalBookmarks || 0}</strong> bookmarks across{' '}
              <strong>{data.totalCollections || 0}</strong> collections, tagged with{' '}
              <strong>{data.totalTags || 0}</strong> unique tags.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Recent Activity</h4>
            <p className="text-sm">
              In the selected period, you performed <strong>{data.totalSearches || 0}</strong> searches
              and imported/exported content <strong>{(data.totalImports || 0) + (data.totalExports || 0)}</strong> times.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
