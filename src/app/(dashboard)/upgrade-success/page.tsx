'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, ArrowRight, Loader2, Crown, Sparkles, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface PricingPlan {
  id: string;
  name: string;
  price: string;
  interval: string;
  features: string[];
}

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    interval: 'forever',
    features: [
      'Up to 100 bookmarks',
      'Up to 5 collections',
      'Basic search',
      'Manual organization',
    ]
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99',
    interval: 'month',
    features: [
      'Unlimited bookmarks',
      'Unlimited collections',
      'Advanced search with filters',
      'Import and export in any format',
      'Priority support',
    ]
  },
  {
    id: 'team',
    name: 'Team',
    price: '$9.99',
    interval: 'month',
    features: [
      'Unlimited bookmarks',
      'Unlimited collections',
      'Advanced search with filters',
      'Import and export in any format',
      'Priority support',
      'Team collaboration features',
      'Shared collections',
      'Role-based access control',
    ]
  },
];

export default function UpgradeSuccessPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [plan, setPlan] = useState<PricingPlan | null>(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const planId = searchParams.get('plan');

    if (!sessionId) {
      setStatus('error');
      setMessage('Invalid session. Please try upgrading again.');
      return;
    }

    const getPlanById = (id: string | null): PricingPlan | null => {
      if (!id) return null;
      return PRICING_PLANS.find(p => p.id === id) ?? null;
    };

    const initialPlan = getPlanById(planId);
    if (initialPlan) {
      setPlan(initialPlan);
    }

    const verifySession = async () => {
      try {
        const params = new URLSearchParams({ session_id: sessionId });
        const response = await fetch(`/api/stripe/verify-session?${params.toString()}`);

        if (response.ok) {
          const data = await response.json();
          setStatus('success');
          setMessage(data.message || 'Your subscription has been activated successfully!');

          const verifiedPlan = getPlanById(data.plan ?? null);
          if (verifiedPlan) {
            setPlan(verifiedPlan);
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          setStatus('error');
          setMessage(errorData.error || 'Failed to verify your subscription');
        }
      } catch (error) {
        console.error('Failed to verify subscription session:', error);
        setStatus('error');
        setMessage('An error occurred while verifying your subscription');
      }
    };

    verifySession();
  }, [searchParams]);

  return (
    <div className="container mx-auto py-16 px-4">
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center space-y-4">
          {status === 'loading' && (
            <>
              <div className="flex justify-center">
                <Loader2 className="w-16 h-16 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl">Processing Your Subscription</CardTitle>
              <CardDescription>Please wait while we confirm your subscription...</CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Crown className="w-6 h-6 text-yellow-500" />
                Upgrade Successful!
              </CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <XCircle className="w-16 h-16 text-red-500" />
              </div>
              <CardTitle className="text-2xl">Something Went Wrong</CardTitle>
              <CardDescription>{message}</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="space-y-6">
          {status === 'success' && plan && (
            <>
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <span className="font-semibold flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {plan.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Price</span>
                  <span className="font-semibold">
                    {plan.price}/{plan.interval}
                  </span>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-4 text-left">
                <h3 className="font-semibold mb-3">What&apos;s included:</h3>
                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-3">
                <Button className="w-full" asChild>
                  <Link href="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/settings">Manage Subscription</Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                A confirmation email has been sent to your email address.
              </p>
            </>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <Button className="w-full" asChild>
                <Link href="/pricing">Back to Pricing</Link>
              </Button>
              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
