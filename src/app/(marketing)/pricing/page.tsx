import Link from 'next/link';
import { Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { SUBSCRIPTION_PLANS } from '@/lib/subscription/plans';

export default function PricingPage() {
  const plans = Object.values(SUBSCRIPTION_PLANS);

  return (
    <div className="container mx-auto py-16 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Choose the plan that&apos;s right for you. Start free, upgrade when you&apos;re ready.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => {
          const isPro = plan.id === 'pro';
          const isTeam = plan.id === 'team';

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isPro ? 'border-primary shadow-lg scale-105' : ''
              }`}
            >
              {isPro && (
                <div className="absolute -top-4 left-0 right-0 flex justify-center">
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                    <Sparkles className="w-4 h-4" />
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>
                  {isTeam
                    ? 'For teams and organizations'
                    : isPro
                    ? 'For power users'
                    : 'For getting started'}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-4xl font-bold">${plan.price}</span>
                  {plan.price > 0 && (
                    <span className="text-muted-foreground">/month</span>
                  )}
                </div>

                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={`${feature.slice(0, 10)}-${index}`} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 pt-6 border-t">
                  <p className="text-sm text-muted-foreground mb-3">Limits:</p>
                  <ul className="space-y-1 text-sm">
                    <li>
                      Bookmarks:{' '}
                      {plan.limits.bookmarks === -1
                        ? 'Unlimited'
                        : plan.limits.bookmarks.toLocaleString()}
                    </li>
                    <li>
                      Collections:{' '}
                      {plan.limits.collections === -1
                        ? 'Unlimited'
                        : plan.limits.collections}
                    </li>
                    {plan.limits.teamMembers && (
                      <li>Team members: {plan.limits.teamMembers}</li>
                    )}
                  </ul>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isPro ? 'default' : 'outline'}
                  asChild
                >
                  {plan.price === 0 ? (
                    <Link href="/dashboard">Get Started Free</Link>
                  ) : isTeam ? (
                    <Link href="mailto:support@mimebookmark.com">Contact Sales</Link>
                  ) : (
                    <Link href={`/upgrade?plan=${plan.id}`}>Upgrade to {plan.name}</Link>
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-16 text-center">
        <p className="text-muted-foreground mb-4">
          Have questions about enterprise plans?
        </p>
        <Button variant="outline" asChild>
          <Link href="mailto:support@mimebookmark.com">Contact Sales</Link>
        </Button>
      </div>

      <div className="mt-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
            <p className="text-muted-foreground">
              Yes, you can cancel your subscription at any time. You&apos;ll continue to
              have access to your paid features until the end of your billing
              period.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
            <p className="text-muted-foreground">
              We accept all major credit cards through Stripe, including Visa,
              MasterCard, and American Express.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Is there a free trial?</h3>
            <p className="text-muted-foreground">
              Our Free plan lets you try basic features forever. Upgrade when you
              need more power.
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-2">Can I switch plans?</h3>
            <p className="text-muted-foreground">
              Yes, you can upgrade or downgrade at any time. Changes take effect
              immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
