'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CreditCard, Calendar, RefreshCw, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';

interface BillingData {
  currentPlan: string;
  nextBillingDate: string | null;
  cardLast4: string | null;
  cardExpiry: string | null;
  invoices: Array<{
    id: string;
    date: string;
    amount: number;
    status: 'paid' | 'pending' | 'failed';
  }>;
  usage: {
    bookmarksUsed: number;
    bookmarksLimit: number;
    collectionsUsed: number;
    collectionsLimit: number;
  };
}

export default function BillingPage() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const planKey = (billingData?.currentPlan ?? 'free') as keyof typeof SUBSCRIPTION_PLANS;
  const currentPlan = SUBSCRIPTION_PLANS[planKey] ?? SUBSCRIPTION_PLANS.free;

  const fetchBillingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/me/billing');
      if (!response.ok) {
        throw new Error('Failed to fetch billing data');
      }
      const data = await response.json();
      setBillingData(data);
    } catch (error) {
      console.error('Failed to fetch billing data:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to load billing information',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleUpgrade = async (planId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate checkout');
      }

      const { checkoutUrl } = await response.json();
      
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Checkout failed:', error);
      toast({
        title: 'Checkout Failed',
        description: error instanceof Error ? error.message : 'Unable to start checkout process',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to open customer portal');
      }

      const { portalUrl } = await response.json();
      
      if (portalUrl) {
        const newWindow = window.open(portalUrl, '_blank', 'noopener,noreferrer');
        if (newWindow) newWindow.opener = null;
      } else {
        throw new Error('No portal URL returned');
      }
    } catch (error) {
      console.error('Failed to open portal:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unable to open subscription management',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch('/api/stripe/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      toast({
        title: 'Subscription Canceled',
        description: 'Your subscription has been canceled. You will retain access until the end of your billing period.',
      });
      
      await fetchBillingData();
    } catch (error) {
      console.error('Cancellation failed:', error);
      toast({
        title: 'Cancellation Failed',
        description: error instanceof Error ? error.message : 'Unable to cancel subscription',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Validate date
    if (isNaN(date.getTime()) || !isFinite(date.getTime())) {
      return '-';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getInvoiceStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!billingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="mt-4 text-destructive">Failed to load billing data</p>
        <Button onClick={fetchBillingData} disabled={isLoading} variant="outline" className="mt-4">
          {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-2">
          Manage your subscription and billing information
        </p>
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Badge variant={billingData.currentPlan === 'free' ? 'secondary' : 'default'}>
              {billingData.currentPlan.toUpperCase()}
            </Badge>
            Current Plan
          </CardTitle>
          <CardDescription>
            You are currently on the {currentPlan.name} plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary rounded-full flex items-center justify-center text-primary-foreground">
                <span className="text-lg font-bold">{currentPlan.name}</span>
              </div>
              <div>
                <p className="text-sm font-medium">${currentPlan.price}</p>
                <p className="text-xs text-muted-foreground">per month</p>
              </div>
            </div>
            <Button
              variant={billingData.currentPlan === 'free' ? 'default' : 'outline'}
              onClick={() => {
                if (billingData.currentPlan === 'free') {
                  handleUpgrade('pro');
                } else {
                  // For downgrades, use subscription-management flow instead of checkout
                  handleManageSubscription();
                }
              }}
            >
              {billingData.currentPlan === 'free' ? 'Upgrade Plan' : 'Change Plan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-muted rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Bookmarks</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
                  {billingData.usage.bookmarksUsed}
                </span>
            <span className="text-sm text-muted-foreground">
                  / {billingData.usage.bookmarksLimit === -1 ? 'Unlimited' : billingData.usage.bookmarksLimit}
                </span>
          </div>
        </div>
        <div className="bg-muted rounded-lg p-4">
          <p className="text-sm text-muted-foreground mb-1">Collections</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
                  {billingData.usage.collectionsUsed}
                </span>
            <span className="text-sm text-muted-foreground">
                  / {billingData.usage.collectionsLimit === -1 ? 'Unlimited' : billingData.usage.collectionsLimit}
                </span>
          </div>
        </div>
      </div>

      {/* Next Billing */}
      {billingData.nextBillingDate && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Calendar className="h-4 w-4" />
            Next billing date
          </div>
          <p className="font-semibold">
            {formatDate(billingData.nextBillingDate)}
          </p>
        </div>
      )}

      {/* Card Info */}
      {(billingData.cardLast4 || billingData.cardExpiry) && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <CreditCard className="h-4 w-4" />
            Payment method
          </div>
          <div className="space-y-1">
            {billingData.cardLast4 && (
              <p className="text-sm">
                Ending in <span className="font-semibold">{billingData.cardLast4}</span>
              </p>
            )}
            {billingData.cardExpiry && (
              <p className="text-sm text-muted-foreground">
                Expires <span className="font-semibold">{billingData.cardExpiry}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Subscription Management */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Manage Subscription</CardTitle>
            <CardDescription>
              Upgrade, downgrade, or manage your payment method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              className="w-full"
              onClick={handleManageSubscription}
              disabled={isProcessing}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isProcessing ? 'Loading...' : 'Manage Subscription'}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Opens Stripe customer portal to update payment methods and view invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Plan</CardTitle>
            <CardDescription>
              Upgrade to access premium features or downgrade to free
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {Object.values(SUBSCRIPTION_PLANS).map((plan) => {
                const isCurrentPlan = plan.id === billingData.currentPlan;
                const isUpgrade = plan.price > 0 && billingData.currentPlan === 'free';
                
                return (
                  <div
                    key={plan.id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all ${
                      isCurrentPlan 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-lg font-bold">{plan.price === 0 ? 'Free' : `$${plan.price}/mo`}</p>
                      {plan.price === 0 && (
                        <p className="text-xs text-muted-foreground">
                          {plan.limits.bookmarks} bookmarks
                        </p>
                      )}
                    </div>
                    {!isCurrentPlan && isUpgrade && (
                      <Button
                        size="sm"
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={isProcessing}
                      >
                        Upgrade
                      </Button>
                    )}
                    {!isCurrentPlan && !isUpgrade && (
                      <span className="text-xs text-muted-foreground">Manage via cancel</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Subscription */}
      {billingData.currentPlan !== 'free' && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Cancel Subscription
            </CardTitle>
            <CardDescription>
              Cancel your subscription. You will lose access to premium features at the end of your billing period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isProcessing}
              className="w-full"
            >
              <XCircle className="mr-2 h-4 w-4" />
              {isProcessing ? 'Canceling...' : 'Cancel Subscription'}
            </Button>
            <p className="text-xs text-destructive/60 mt-2">
              Warning: This action cannot be undone. You will lose access to premium features at the end of your billing period.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>
            View your past invoices and payment history
          </CardDescription>
        </CardHeader>
        <CardContent>
          {billingData.invoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No invoices yet
            </div>
          ) : (
            <div className="space-y-2">
              {billingData.invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-4 bg-muted rounded-lg"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">{invoice.id}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(invoice.date)}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <Badge className={getInvoiceStatusColor(invoice.status)}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                    <p className="text-lg font-bold">
                      {invoice.amount < 0 ? `-$${Math.abs(invoice.amount).toFixed(2)}` : `$${invoice.amount.toFixed(2)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Billing Support
          </CardTitle>
          <CardDescription>
            Need help with billing or subscription issues?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            For billing questions, refunds, or account issues, please contact our support team.
          </p>
          <div className="space-y-2">
            <Button 
              variant="outline" 
              className="w-full"
              asChild
            >
              <a href="mailto:support@mimebookmark.com">Contact Support</a>
            </Button>
            <Button 
              variant="outline" 
              className="w-full"
              asChild
            >
              <a href="/pricing">View Plans</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
