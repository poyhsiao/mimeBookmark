import { useMemo } from "react";
import { useSubscription } from "./use-subscription";
import type { PlanType } from "@/types/subscription";

// Define tier order for comparison (lower index = lower tier)
const TIER_ORDER: Record<PlanType, number> = {
  free: 0,
  pro: 1,
  team: 2,
};

// Get the app URL with proper fallback to ensure consistent SSR/client behavior
// Returns a deterministic value regardless of environment
function getAppUrl(): string {
  // Prefer environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  // Fallback to empty string - upgradeUrl will use relative path when appUrl is empty
  return '';
}

interface UsePremiumFeatureOptions {
  requiredTier: PlanType;
}

export function usePremiumFeature({ requiredTier }: UsePremiumFeatureOptions): {
  isAllowed: boolean;
  userTier: PlanType;
  isLoading: boolean;
  upgradeUrl: string;
} {
  const { subscriptionTier, subscription, isLoading } = useSubscription();

  // Memoize appUrl to ensure stable value across renders
  const appUrl = useMemo(() => getAppUrl(), []);

  return useMemo(() => {
    // Use subscriptionTier from profile as primary source, fallback to subscription?.tier
    const userTier: PlanType = subscriptionTier || subscription?.tier || "free";

    const userTierLevel = TIER_ORDER[userTier];
    const requiredTierLevel = TIER_ORDER[requiredTier];
    const isAllowed = userTierLevel >= requiredTierLevel;

    // Use appUrl directly - when empty, upgradeUrl will be a relative path
    const upgradeUrl = appUrl
      ? `${appUrl}/settings/billing?upgrade=${requiredTier}`
      : `/settings/billing?upgrade=${requiredTier}`;

    return {
      isAllowed,
      userTier,
      isLoading,
      upgradeUrl,
    };
  }, [subscriptionTier, subscription, requiredTier, isLoading, appUrl]);
}

// Hook specifically for checking if user has at least Pro tier
export function useIsPro(): {
  isPro: boolean;
  userTier: PlanType;
  isLoading: boolean;
} {
  const { subscriptionTier, subscription, isLoading } = useSubscription();

  return useMemo(() => {
    const userTier: PlanType = subscriptionTier || subscription?.tier || "free";
    const isPro = TIER_ORDER[userTier] >= TIER_ORDER.pro;

    return {
      isPro,
      userTier,
      isLoading,
    };
  }, [subscriptionTier, subscription, isLoading]);
}

// Hook specifically for checking if user has Team tier
export function useIsTeam(): {
  isTeam: boolean;
  userTier: PlanType;
  isLoading: boolean;
} {
  const { subscriptionTier, subscription, isLoading } = useSubscription();

  return useMemo(() => {
    const userTier: PlanType = subscriptionTier || subscription?.tier || "free";
    const isTeam = userTier === "team";

    return {
      isTeam,
      userTier,
      isLoading,
    };
  }, [subscriptionTier, subscription, isLoading]);
}
