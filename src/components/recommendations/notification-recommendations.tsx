'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, ExternalLink, X, Check } from 'lucide-react';
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

interface NotificationRecommendationsProps {
  maxDisplay?: number;
  userId: string;
}

export function NotificationRecommendations({
  maxDisplay = 3,
  userId,
}: NotificationRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const response = await fetch(`/api/recommendations/user?context=notification&userId=${encodeURIComponent(userId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data && Array.isArray(data.recommendations)) {
            setRecommendations(data.recommendations.slice(0, maxDisplay));
          } else {
            console.warn('Invalid recommendations response format:', data);
            setRecommendations([]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch recommendations:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRecommendations();
  }, [maxDisplay, userId]);

  if (isLoading) {
    return null;
  }

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Bell className="h-4 w-4" />
        <span>{t.recommendations.forYou}</span>
      </div>

      {recommendations.map((result) => (
        <NotificationCard key={result.ruleId} result={result} />
      ))}
    </div>
  );
}

interface NotificationCardProps {
  result: Recommendation;
}

function NotificationCard({ result }: NotificationCardProps) {
  const { recommendation } = result;
  const safeUrl =
    recommendation.url && /^(https?:\/\/|\/(?!\/))/.test(recommendation.url)
      ? recommendation.url
      : undefined;
  const [isDismissed, setIsDismissed] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
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

  const handleClick = async (e?: React.MouseEvent) => {
    if (hasInteracted || !safeUrl) return;
    setHasInteracted(true);

    // Use sendBeacon for reliable tracking before navigation
    const payload = JSON.stringify({
      ruleId: result.ruleId,
      eventType: 'click',
    });

    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/recommendations/user', blob);
  };

  if (isDismissed || hasInteracted) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
              {recommendation.type === 'external_link' && '📌'}
              {recommendation.type === 'featured_collection' && '📁'}
              {recommendation.type === 'promotion' && '🔥'}
              {recommendation.type === 'newsletter' && '📧'}
            </span>
            <span className="text-xs text-muted-foreground">
              {t.recommendations.recommended}
            </span>
          </div>

          <h4 className="font-medium truncate">{recommendation.title}</h4>
          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
            {recommendation.description}
          </p>

          <div className="flex items-center gap-2 mt-3">
            {safeUrl && (
              <a
                href={safeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  if (safeUrl) {
                    window.open(safeUrl, '_blank', 'noopener,noreferrer');
                    handleClick();
                  }
                }}
              >
                <ExternalLink className="h-3 w-3" />
                {recommendation.ctaText}
              </a>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleClick}
              aria-label={t.recommendations.markAsRead(recommendation.title)}
            >
              <Check className="h-3 w-3 mr-1" />
              {t.recommendations.read}
            </Button>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={handleDismiss}
          aria-label={t.recommendations.dismiss(recommendation.title)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </Card>
  );
}
