'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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
  const mountedRef = useRef<boolean>(false);

  const fetchSubscription = useCallback(async () => {
    if (!mountedRef.current) {
      return;
    }

    try {
      if (!mountedRef.current) {
        return;
      }
      setIsLoading(true);
      const supabase = createClient();

      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error(userError?.message || 'User not authenticated');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('subscription_status, subscription_tier, subscription_id')
        .eq('id', user.id)
        .single();

      if (profileError) {
        throw new Error(profileError.message);
      }

      if (profile && mountedRef.current) {
        setError(null);
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

          if (subData && mountedRef.current) {
            setSubscription(subData as Subscription);
          }
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        const message = err instanceof Error ? err.message : 'Failed to fetch subscription';
        setError(new Error(message));
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const initSubscription = async () => {
      await fetchSubscription();
    };

    initSubscription();

    return () => {
      mountedRef.current = false;
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
