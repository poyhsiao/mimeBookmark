'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, X, Sparkles } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

interface Recommendation {
  ruleId: string;
  ruleName: string;
  score: number;
  reason: string;
  recommendation: {
    type: string;
    url?: string;
    title: string;
    description: string;
    ctaText: string;
  };
}

interface SearchRecommendationsProps {
  query: string;
  userId: string;
}

// Safe URL hostname extraction
function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function SearchRecommendations({
  query,
  userId,
}: SearchRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!query || query.length < 2) {
        setRecommendations([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/recommendations/search?query=${encodeURIComponent(query)}&userId=${encodeURIComponent(userId)}`
        );
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommendations || []);
        } else {
          // Clear stale results on error
          setRecommendations([]);
          console.error('Failed to fetch recommendations:', {
            status: response.status,
            statusText: response.statusText,
          });
          // Optionally log response body for debugging
          try {
            const errorText = await response.text();
            if (errorText) {
              console.error('Error response body:', errorText);
            }
          } catch (e) {
            // Ignore if response body cannot be read
          }
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchRecommendations();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, userId]);

  if (isLoading) {
    return null;
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>{t.recommendations.title}</span>
      </div>

      {recommendations.map((result, index) => (
        <RecommendationCard
          key={`${result.ruleId}-${index}`}
          result={result}
        />
      ))}
    </div>
  );
}

interface RecommendationCardProps {
  result: Recommendation;
}

function RecommendationCard({ result }: RecommendationCardProps) {
  const { recommendation } = result;
  const [isDismissed, setIsDismissed] = useState(false);
  const { t } = useTranslation();

  const handleDismiss = async () => {
    setIsDismissed(true);

    try {
      await fetch('/api/recommendations/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId: result.ruleId,
          eventType: 'dismiss',
        }),
      });
    } catch (error) {
      console.error('Failed to track dismiss:', error);
    }
  };

  const handleClick = async () => {
    try {
      const payload = JSON.stringify({
        ruleId: result.ruleId,
        eventType: 'click',
      });

      // Use sendBeacon for reliable tracking before navigation
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/recommendations/user', blob);
      } else {
        // Fallback to fetch when sendBeacon is not available
        await fetch('/api/recommendations/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      }
    } catch (error) {
      console.error('Failed to track click:', error);
    }
  };

  if (isDismissed) {
    return null;
  }

  return (
    <Card className="p-4 hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
              {recommendation.type.replace(/_/g, ' ')}
            </span>
            {recommendation.url && (
              <span className="text-xs text-muted-foreground truncate">
                {getHostname(recommendation.url)}
              </span>
            )}
          </div>

          <h4 className="font-medium truncate">{recommendation.title}</h4>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {recommendation.description}
          </p>

          {recommendation.url && (
            <a
              href={recommendation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
              onClick={handleClick}
            >
              <ExternalLink className="h-3 w-3" />
              {t.recommendations.visitLink}
            </a>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
          aria-label={t.recommendations.dismissAria(recommendation.title)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
