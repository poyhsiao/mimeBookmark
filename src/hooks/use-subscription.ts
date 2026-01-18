'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';
import type { Subscription, SubscriptionStatus, PlanType } from '@/types/subscription';

interface UseSubscriptionLimits {
  bookmarks: number;
  collections: number;
  tags: number;
}

interface UseSubscriptionUsage {
  bookmarks: number;
  collections: number;
  tags: number;
}

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionTier: PlanType | null;
  limits: UseSubscriptionLimits;
  usage: UseSubscriptionUsage;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  openCheckout: (planId: PlanType) => Promise<void>;
  cancelSubscription: () => Promise<void>;
  portalUrl: string | null;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<PlanType | null>(null);
  const [limits, setLimits] = useState<UseSubscriptionLimits>({
    bookmarks: SUBSCRIPTION_PLANS.free.limits.bookmarks,
    collections: SUBSCRIPTION_PLANS.free.limits.collections,
    tags: SUBSCRIPTION_PLANS.free.limits.tags,
  });
  const [usage, setUsage] = useState<UseSubscriptionUsage>({
    bookmarks: 0,
    collections: 0,
    tags: 0,
  });
  const [portalUrl, setPortalUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_tier, subscription_id, stripe_customer_id, bookmarks_limit, collections_limit, tags_limit, bookmarks_count')
        .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile) {
        const tier = (profile.subscription_tier as PlanType) || 'free';
        const plan = SUBSCRIPTION_PLANS[tier];

        setSubscriptionStatus(profile.subscription_status as SubscriptionStatus | null);
        setSubscriptionTier(tier);

        setLimits({
          bookmarks: profile.bookmarks_limit || plan.limits.bookmarks,
          collections: profile.collections_limit || plan.limits.collections,
          tags: profile.tags_limit || plan.limits.tags,
        });

        const { count: collectionsCount } = await supabase
          .from('collections')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        const { count: tagsCount } = await supabase
          .from('tags')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        setUsage({
          bookmarks: profile.bookmarks_count || 0,
          collections: collectionsCount || 0,
          tags: tagsCount || 0,
        });

        if (profile.subscription_id) {
          const { data: subData, error: subError } = await supabase
            .from('subscriptions')
            .select('*')
            .eq('id', profile.subscription_id)
            .single();

          if (subError && subError.code !== 'PGRST116') {
            throw new Error(subError.message);
          }

          if (subData) {
            setSubscription(subData as Subscription);
          }
        } else {
          setSubscription(null);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch subscription';
      setError(new Error(message));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const openCheckout = useCallback(async (planId: PlanType) => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open checkout';
      setError(new Error(message));
    }
  }, []);

  const cancelSubscription = useCallback(async () => {
    try {
      const response = await fetch('/api/stripe/cancel', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel subscription');
      }

      await fetchSubscription();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
      setError(new Error(message));
    }
  }, [fetchSubscription]);

  useEffect(() => {
    let mounted = true;

    const initSubscription = async () => {
      await fetchSubscription();
    };

    initSubscription();

    return () => {
      mounted = false;
    };
  }, [fetchSubscription]);

  return {
    subscription,
    subscriptionStatus,
    subscriptionTier,
    limits,
    usage,
    isLoading,
    error,
    refresh: fetchSubscription,
    openCheckout,
    cancelSubscription,
    portalUrl,
  };
}
