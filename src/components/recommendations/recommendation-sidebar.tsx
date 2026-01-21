'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Sparkles } from 'lucide-react';

interface Recommendation {
  id: string;
  bookmark_url: string | null;
  title: string;
  description: string;
  cta_text: string;
  rule_id: string;
}

interface RecommendationSidebarProps {
  context?: 'sidebar' | 'search' | 'bookmark_add';
  maxItems?: number;
}

export function RecommendationSidebar({
  context = 'sidebar',
  maxItems = 3
}: RecommendationSidebarProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();

    async function fetchRecommendations() {
      try {
        const response = await fetch(
          `/api/recommendations/user?context=${context}&limit=${maxItems}`,
          { signal: controller.signal }
        );

        // Check if the request was aborted
        if (controller.signal.aborted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
        }
      } catch (error) {
        // Ignore abort errors - they're expected during cleanup
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        console.error('Failed to fetch recommendations:', error);
      } finally {
        // Only update loading state if not aborted
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchRecommendations();

    // Cleanup: abort in-flight requests when dependencies change
    return () => {
      controller.abort();
    };
  }, [context, maxItems]);

  const handleClick = (recommendation: Recommendation) => {
    if (recommendation.bookmark_url) {
      window.open(recommendation.bookmark_url, '_blank', 'noopener,noreferrer');
    }
    void fetch(`/api/recommendations/user/${recommendation.id}/click`, {
      method: 'POST'
    }).catch(error => {
      console.error('Failed to track click:', error);
    });
  };

  const handleDismiss = async (id: string) => {
    setDismissed(prev => new Set([...prev, id]));

    try {
      const response = await fetch(`/api/recommendations/user/${id}/dismiss`, {
        method: 'POST'
      });

      if (!response.ok) {
        setDismissed(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        console.error('Failed to dismiss recommendation: Server returned error');
      }
    } catch (error) {
      setDismissed(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      console.error('Failed to dismiss recommendation:', error);
    }
  };

  const visibleRecommendations = recommendations.filter(
    rec => !dismissed.has(rec.id)
  );

  if (loading) {
    return (
      <div className="bg-card rounded-lg p-4 border">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Recommended for You</h3>
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visibleRecommendations.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg p-4 border">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Recommended for You</h3>
      </div>

      <div className="space-y-4">
        {visibleRecommendations.map(recommendation => (
          <div
            key={recommendation.id}
            className="group relative bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors"
          >
            <button
              onClick={() => handleDismiss(recommendation.id)}
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity p-1 hover:bg-background focus:outline-none focus:ring-2 focus:ring-primary rounded"
              aria-label="Dismiss recommendation"
            >
              <X className="w-3 h-3 text-muted-foreground" />
            </button>

            <h4 className="font-medium text-sm pr-6">{recommendation.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {recommendation.description}
            </p>

            <button
              onClick={() => handleClick(recommendation)}
              className="mt-2 text-xs flex items-center gap-1 text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!recommendation.bookmark_url}
            >
              {recommendation.cta_text}
              {recommendation.bookmark_url && (
                <ExternalLink className="w-3 h-3" />
              )}
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-4 text-center">
        Personalized based on your bookmarks and tags
      </p>
    </div>
  );
}
