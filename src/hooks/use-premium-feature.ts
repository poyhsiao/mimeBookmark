'use client';

import { useAuth } from '@/hooks/use-auth';
import { useSubscription } from './use-subscription';
import type { PlanType } from '@/types/subscription';

interface UsePremiumFeatureOptions {
  requiredTier?: PlanType;
  featureKey?: string;
  showUpgradePrompt?: boolean;
}

interface UsePremiumFeatureResult {
  isAllowed: boolean;
  isLoading: boolean;
  error: Error | null;
  upgrade: () => void;
  remaining?: {
    bookmarks: number;
    collections: number;
    tags: number;
  };
}

export function usePremiumFeature(
  options: UsePremiumFeatureOptions = {}
): UsePremiumFeatureResult {
  const {
    requiredTier = 'pro',
    featureKey,
    showUpgradePrompt = true,
  } = options;

  const { user, isLoading: authLoading } = useAuth();
  const {
    subscription,
    limits,
    usage,
    isLoading: subLoading,
    error,
    openCheckout,
  } = useSubscription();

  const isLoading = authLoading || subLoading;

  const tierOrder: Record<PlanType, number> = {
    free: 0,
    pro: 1,
    team: 2,
  };

  const userTier = subscription?.tier || 'free';
  const isAllowed = tierOrder[userTier] >= tierOrder[requiredTier];

  const calculateRemaining = () => {
    if (userTier === 'free') {
      const remainingBookmarks = (limits.bookmarks || 500) - (usage.bookmarks || 0);
      const remainingCollections = (limits.collections || 10) - (usage.collections || 0);
      const remainingTags = (limits.tags || 50) - (usage.tags || 0);

      return {
        bookmarks: Math.max(0, remainingBookmarks),
        collections: Math.max(0, remainingCollections),
        tags: Math.max(0, remainingTags),
      };
    }
    return undefined;
  };

  const upgrade = () => {
    if (showUpgradePrompt && user) {
      openCheckout(requiredTier);
    }
  };

  return {
    isAllowed,
    isLoading,
    error,
    upgrade,
    remaining: calculateRemaining(),
  };
}

export function useFeatureLimit(): {
  canAddBookmark: boolean;
  canAddCollection: boolean;
  canAddTag: boolean;
  bookmarkRemaining: number;
  collectionRemaining: number;
  tagRemaining: number;
  isAtLimit: boolean;
} {
  const { user, isLoading: authLoading } = useAuth();
  const {
    subscription,
    limits,
    usage,
    isLoading: subLoading,
  } = useSubscription();

  const isLoading = authLoading || subLoading;

  const tier = subscription?.tier || 'free';
  const effectiveLimits = tier === 'free' ? limits : null;

  if (isLoading || !effectiveLimits) {
    return {
      canAddBookmark: true,
      canAddCollection: true,
      canAddTag: true,
      bookmarkRemaining: -1,
      collectionRemaining: -1,
      tagRemaining: -1,
      isAtLimit: false,
    };
  }

  const bookmarkRemaining = effectiveLimits.bookmarks - (usage.bookmarks || 0);
  const collectionRemaining = effectiveLimits.collections - (usage.collections || 0);
  const tagRemaining = effectiveLimits.tags - (usage.tags || 0);

  const canAddBookmark = bookmarkRemaining > 0;
  const canAddCollection = collectionRemaining > 0;
  const canAddTag = tagRemaining > 0;
  const isAtLimit = !canAddBookmark || !canAddCollection || !canAddTag;

  return {
    canAddBookmark,
    canAddCollection,
    canAddTag,
    bookmarkRemaining: Math.max(0, bookmarkRemaining),
    collectionRemaining: Math.max(0, collectionRemaining),
    tagRemaining: Math.max(0, tagRemaining),
    isAtLimit,
  };
}
