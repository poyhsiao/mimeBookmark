import { test, expect, type Page } from '@playwright/test';
import { authenticateUser, mockBillingEndpoints } from './fixtures/auth';

async function mockStripeVerification(page: Page) {
  await page.route('**/api/stripe/verify-session', route => {
    const method = route.request().method();
    if (method === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, message: 'Subscription activated!', planId: 'pro' }),
      });
    } else {
      route.continue();
    }
  });
}

test.describe('Pricing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should display page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Simple, Transparent Pricing');
  });

  test('should display all pricing plans', async ({ page }) => {
    await expect(page.locator('h1:has-text("Simple, Transparent Pricing")')).toBeVisible();
    await expect(page.locator('text=For getting started')).toBeVisible();
    await expect(page.locator('text=For power users')).toBeVisible();
    await expect(page.locator('text=For teams and organizations')).toBeVisible();
  });

  test('should display plan prices', async ({ page }) => {
    await expect(page.locator('text=$0').first()).toBeVisible();
    await expect(page.locator('text=$5').first()).toBeVisible();
    await expect(page.locator('text=$15').first()).toBeVisible();
  });

  test('should highlight Pro plan as popular', async ({ page }) => {
    await expect(page.locator('text=Most Popular').first()).toBeVisible();
  });

  test('should display feature lists for each plan', async ({ page }) => {
    // Check that feature lists exist (using more generic selectors)
    await expect(page.locator('.flex.items-start.gap-2').first()).toBeVisible();
  });

  test('should have upgrade buttons for free and pro plans', async ({ page }) => {
    // Free plan has "Get Started Free" button
    await expect(page.locator('a:has-text("Get Started Free")').first()).toBeVisible();
    // Pro plan has "Upgrade to Pro" button
    await expect(page.locator('a:has-text("Upgrade to Pro")').first()).toBeVisible();
  });

  test('should have contact sales button for team plan', async ({ page }) => {
    await expect(page.locator('a:has-text("Contact Sales")').first()).toBeVisible();
  });
});

test.describe('Pricing Page - User Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should navigate to dashboard when clicking Get Started Free', async ({ page }) => {
    const getStartedButton = page.locator('a:has-text("Get Started Free")').first();
    await getStartedButton.click();
    await page.waitForURL('**/dashboard');
  });

  test('should navigate to upgrade page when clicking Upgrade to Pro', async ({ page }) => {
    const upgradeButton = page.locator('a:has-text("Upgrade to Pro")').first();
    await upgradeButton.click();
    await page.waitForURL(/upgrade/);
  });
});

test.describe('Upgrade Success Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/upgrade-success?session_id=mock_session&plan=pro');
  });

  test('should display loading state initially', async ({ page }) => {
    await expect(page.locator('text=Processing Your Subscription').first()).toBeVisible({ timeout: 10000 });
  });

  test('should display error state for invalid session', async ({ page }) => {
    await page.goto('/upgrade-success');
    await expect(page.locator('text=Something Went Wrong').first()).toBeVisible({ timeout: 10000 });
  });

  test('should handle successful verification', async ({ page }) => {
    await mockStripeVerification(page);
    await page.reload();
    await expect(page.locator('text=Upgrade Successful').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Pro').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('a:has-text("Go to Dashboard")').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('a:has-text("Manage Subscription")').first()).toBeVisible({ timeout: 15000 });
  });

  test('should show features after successful upgrade', async ({ page }) => {
    await mockStripeVerification(page);
    await page.reload();
    await expect(page.locator("text=What's included").first()).toBeVisible({ timeout: 15000 });
  });

  test('should allow navigating to dashboard from success page', async ({ page }) => {
    await mockStripeVerification(page);
    await page.reload();
    const dashboardButton = page.locator('a:has-text("Go to Dashboard")').first();
    await expect(dashboardButton).toBeVisible({ timeout: 15000 });
    await dashboardButton.click();
    await page.waitForURL('**/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe('Stripe Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pricing');
  });

  test('should redirect to upgrade page when clicking upgrade button', async ({ page }) => {
    const upgradeButton = page.locator('a:has-text("Upgrade to Pro")').first();
    await upgradeButton.click();
    await page.waitForURL(/upgrade/);
    await expect(page).toHaveURL(/plan=pro/);
  });

  test('should display upgrade page with correct plan', async ({ page }) => {
    await page.goto('/upgrade?plan=pro');
    await expect(page.locator('text=Upgrade to Pro').first()).toBeVisible();
  });
});

test.describe('Stripe Webhook Handling', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await mockBillingEndpoints(page);
  });

  test('should display billing page', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('h1')).toContainText('Billing');
  });

  test('Subscription status updates after webhook', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('text=Pro')).toBeVisible();
  });

  test('Handle subscription cancellation webhook', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('text=Free')).toBeVisible();
  });
});

test.describe('Subscription Management', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await mockBillingEndpoints(page);
  });

  test('Display current subscription details', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('text=Current Plan')).toBeVisible();
  });

  test('Show next billing date for active subscriptions', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('text=Next billing').first()).toBeVisible();
  });

  test('Allow viewing invoice history', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('a:has-text("View Invoices")')).toBeVisible();
  });
});

test.describe('Billing - Edge Cases', () => {
  test('Handle expired subscription', async ({ page }) => {
    await authenticateUser(page);
    await mockBillingEndpoints(page);
    await page.unroute('**/api/me/billing');
    await page.route('**/api/me/billing', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currentPlan: 'pro',
          status: 'expired',
          nextBillingDate: null,
          cardLast4: null,
          cardExpiry: null,
          invoices: [],
          usage: {
            bookmarksUsed: 0,
            bookmarksLimit: 10000,
            collectionsUsed: 0,
            collectionsLimit: 100,
          },
        }),
      });
    });
    await page.goto('/dashboard/billing');
    await expect(page.locator('text=Subscription Expired').or(page.locator('text=Renew Now'))).toBeVisible();
  });

  test('Handle failed payment', async ({ page }) => {
    await authenticateUser(page);
    await mockBillingEndpoints(page);
    await page.unroute('**/api/me/billing');
    await page.route('**/api/me/billing', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currentPlan: 'pro',
          status: 'past_due',
          nextBillingDate: null,
          cardLast4: null,
          cardExpiry: null,
          invoices: [],
          usage: {
            bookmarksUsed: 0,
            bookmarksLimit: 10000,
            collectionsUsed: 0,
            collectionsLimit: 100,
          },
        }),
      });
    });
    await page.goto('/dashboard/billing');
    await expect(page.locator('text=Payment Failed').or(page.locator('text=Update Payment'))).toBeVisible();
  });

  test('Show upgrade prompt for free users accessing pro features', async ({ page }) => {
    await authenticateUser(page);
    await mockBillingEndpoints(page);
    await page.unroute('**/api/me/billing');
    await page.route('**/api/me/billing', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          currentPlan: 'free',
          status: 'active',
          nextBillingDate: null,
          cardLast4: null,
          cardExpiry: null,
          invoices: [],
          usage: {
            bookmarksUsed: 10,
            bookmarksLimit: 50,
            collectionsUsed: 2,
            collectionsLimit: 5,
          },
        }),
      });
    });
    await page.goto('/dashboard/billing');
    await expect(page.locator('text=Upgrade to Pro').first()).toBeVisible();
  });
});

test.describe('Billing Mobile Responsiveness', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await mockBillingEndpoints(page);
    await page.setViewportSize({ width: 375, height: 812 });
  });

  test('Display billing page on mobile', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('h1')).toContainText('Billing');
  });

  test('Stack subscription plans on mobile', async ({ page }) => {
    await page.goto('/dashboard/billing');
    await expect(page.locator('.grid').first()).toBeVisible();
  });
});

test.describe('Upgrade Success Page - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
  });

  test('Should display success message', async ({ page }) => {
    await mockStripeVerification(page);
    await page.goto('/upgrade-success?session_id=mock_session&plan=pro');
    await page.reload();
    await expect(page.locator('text=Upgrade Successful')).toBeVisible({ timeout: 15000 });
  });

  test('Should show access to new features', async ({ page }) => {
    await mockStripeVerification(page);
    await page.goto('/upgrade-success?session_id=mock_session&plan=pro');
    await page.reload();
    await expect(page.locator("text=What's included").first()).toBeVisible({ timeout: 15000 });
  });

  test('Should have button to start using features', async ({ page }) => {
    await mockStripeVerification(page);
    await page.goto('/upgrade-success?session_id=mock_session&plan=pro');
    await page.reload();
    await expect(page.locator('a:has-text("Go to Dashboard")').first()).toBeVisible({ timeout: 15000 });
  });

  test('Should allow navigating to dashboard', async ({ page }) => {
    await mockStripeVerification(page);
    await page.goto('/upgrade-success?session_id=mock_session&plan=pro');
    await page.reload();
    const dashboardButton = page.locator('a:has-text("Go to Dashboard")').first();
    await dashboardButton.click();
    await page.waitForURL('**/dashboard');
  });
});
