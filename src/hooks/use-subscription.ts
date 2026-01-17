'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Subscription, SubscriptionStatus, PlanType } from '@/types/subscription';

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  subscriptionStatus: SubscriptionStatus | null;
  subscriptionTier: PlanType | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [subscriptionTier, setSubscriptionTier] = useState<PlanType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_tier, subscription_id')
        .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile) {
        setSubscriptionStatus(profile.subscription_status as SubscriptionStatus | null);
        setSubscriptionTier(profile.subscription_tier as PlanType | null);

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
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch subscription';
      setError(new Error(message));
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    isLoading,
    error,
    refresh: fetchSubscription,
  };
}
