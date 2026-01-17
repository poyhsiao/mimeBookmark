'use client';

import { Button } from '@/components/ui/button';
import { usePremiumFeature } from '@/hooks/use-premium-feature';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';
import { Check, Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import type { PlanType, SubscriptionPlan } from '@/types/subscription';

interface PremiumGateProps {
  children: ReactNode;
  requiredTier?: PlanType;
  featureKey?: string;
  showPreview?: boolean;
}

export function PremiumGate({
  children,
  requiredTier = 'pro',
  featureKey,
  showPreview = false,
}: PremiumGateProps) {
  const { isAllowed, isLoading, upgrade, remaining } = usePremiumFeature({
    requiredTier,
    featureKey,
  });

  if (isAllowed) {
    return <>{children}</>;
  }

  if (showPreview) {
    return (
      <div className="relative">
        <div className="blur-sm select-none pointer-events-none opacity-50">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <UpgradePrompt
            requiredTier={requiredTier}
            onUpgrade={upgrade}
            isLoading={isLoading}
          />
        </div>
      </div>
    );
  }

  return (
    <UpgradePrompt
      requiredTier={requiredTier}
      onUpgrade={upgrade}
      isLoading={isLoading}
      remaining={remaining}
    />
  );
}

interface UpgradePromptProps {
  requiredTier: PlanType;
  onUpgrade: () => void;
  isLoading: boolean;
  remaining?: {
    bookmarks: number;
    collections: number;
    tags: number;
  };
}

export function UpgradePrompt({
  requiredTier,
  onUpgrade,
  isLoading,
  remaining,
}: UpgradePromptProps) {
  const plan = SUBSCRIPTION_PLANS[requiredTier];

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
      <div className="p-3 bg-amber-100 dark:bg-amber-900 rounded-full">
        <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
      </div>

      <h3 className="text-xl font-semibold">Upgrade to {plan.name}</h3>

      <p className="text-muted-foreground max-w-sm">
        {requiredTier === 'pro'
          ? 'Unlock unlimited bookmarks, collections, and tags with our Pro plan.'
          : 'Collaborate with your team and share collections with the Team plan.'}
      </p>

      {remaining && (
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>{remaining.bookmarks} bookmarks left</span>
          <span>{remaining.collections} collections left</span>
          <span>{remaining.tags} tags left</span>
        </div>
      )}

      <Button onClick={onUpgrade} disabled={isLoading} size="lg">
        {isLoading ? 'Loading...' : `Upgrade to ${plan.name}`}
      </Button>

      <p className="text-xs text-muted-foreground">
        ${plan.price}/month • Cancel anytime
      </p>
    </div>
  );
}

interface FeatureLimitWarningProps {
  type: 'bookmark' | 'collection' | 'tag';
  current: number;
  limit: number;
  onUpgrade: () => void;
}

export function FeatureLimitWarning({
  type,
  current,
  limit,
  onUpgrade,
}: FeatureLimitWarningProps) {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
      <div>
        <p className="font-medium text-amber-800 dark:text-amber-200">
          {type.charAt(0).toUpperCase() + type.slice(1)} limit reached
        </p>
        <p className="text-sm text-amber-600 dark:text-amber-400">
          You have used {current}/{limit} {type}s. Upgrade to unlock more.
        </p>
      </div>
      <Button variant="outline" onClick={onUpgrade}>
        Upgrade
      </Button>
    </div>
  );
}

interface PricingCardProps {
  planId: PlanType;
  isCurrentPlan?: boolean;
  onSelect: (planId: PlanType) => void;
}

export function PricingCard({ planId, isCurrentPlan, onSelect }: PricingCardProps) {
  const plan = SUBSCRIPTION_PLANS[planId];

  return (
    <div
      className={`relative flex flex-col p-6 border rounded-xl ${
        isCurrentPlan
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/50 transition-colors'
      }`}
    >
      {isCurrentPlan && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
          Current Plan
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-semibold">{plan.name}</h3>
        <div className="flex items-baseline gap-1 mt-2">
          <span className="text-3xl font-bold">${plan.price}</span>
          <span className="text-muted-foreground">/month</span>
        </div>
      </div>

      <ul className="flex-1 space-y-3 mb-6">
        {plan.features.map((feature: string, index: number) => (
          <li key={`${feature}-${index}`} className="flex items-start gap-2 text-sm">
            <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <span>{feature}</span>
          </li>
        ))}
        <li className="flex items-start gap-2 text-sm text-muted-foreground">
          <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
          <span>
            {plan.limits.bookmarks} bookmarks • {plan.limits.collections} collections • {plan.limits.tags} tags
          </span>
        </li>
        {planId === 'team' && (
          <li className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
            <span>{(plan.limits as { teamMembers?: number }).teamMembers || 5} team members</span>
          </li>
        )}
      </ul>

      <Button
        onClick={() => onSelect(planId)}
        disabled={isCurrentPlan}
        variant={isCurrentPlan ? 'outline' : 'default'}
        className="w-full"
      >
        {isCurrentPlan ? 'Current Plan' : planId === 'free' ? 'Downgrade' : 'Upgrade'}
      </Button>
    </div>
  );
}

interface SubscriptionStatusBadgeProps {
  status: string | null;
  tier: string | null;
}

export function SubscriptionStatusBadge({ status, tier }: SubscriptionStatusBadgeProps) {
  const isPro = tier === 'pro' || tier === 'team';

  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
        isPro
          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
          : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      }`}
    >
      {isPro ? 'Premium' : 'Free'}
    </span>
  );
}

export function LimitProgress({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const percentage = Math.min((used / limit) * 100, 100);
  const isNearLimit = percentage >= 80;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isNearLimit ? 'text-amber-600 font-medium' : ''}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isNearLimit ? 'bg-amber-500' : 'bg-primary'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
