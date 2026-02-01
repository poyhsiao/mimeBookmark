import { test, expect } from '@playwright/test';

/**
 * Test file for Stripe Webhook handling in billing flow
 * Tests webhook endpoint mocking, session verification, and UI updates
 */

test.describe('Billing Page - Webhook Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to pricing page first
    await page.goto('/pricing');
  });

  test.describe('Webhook - Mock Webhook Events', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to pricing page
      await page.goto('/pricing');
    });

    test('should mock successful payment webhook event', async ({ page }) => {
      // Mock the verify-session endpoint that upgrade-success calls
      await page.route('/api/stripe/verify-session**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Subscription activated!',
            plan: 'pro',
          }),
        });
      });

      // Mock billing endpoint for the subscription state
      await page.route('/api/me/billing**', route => {
        const nextBillingDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentPlan: 'pro',
            nextBillingDate,
            cardLast4: '4242',
            cardExpiry: '12/25',
            invoices: [],
            usage: {
              bookmarksUsed: 10,
              bookmarksLimit: -1,
              collectionsUsed: 2,
              collectionsLimit: -1,
            },
          }),
        });
      });

      // Navigate to upgrade-success with valid session
      await page.goto('/upgrade-success?session_id=mock_session&plan=pro');
      await page.reload();

      // Should show success state
      await expect(page.locator('text=Upgrade Successful')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=Pro')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=What\'s included')).toBeVisible({ timeout: 15000 });
    });

    test('should mock invoice payment webhook event', async ({ page }) => {
      // Mock the billing API endpoint that the billing page actually calls
      await page.route('/api/me/billing**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentPlan: 'pro',
            nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            cardLast4: '4242',
            cardExpiry: '12/25',
            invoices: [
              { id: 'inv_1', date: new Date().toISOString().slice(0, 10), amount: 15.00, status: 'paid' }
            ],
            usage: {
              bookmarksUsed: 10,
              bookmarksLimit: -1,
              collectionsUsed: 2,
              collectionsLimit: -1,
            },
          }),
        });
      });

      await page.goto('/dashboard/billing');
      await page.reload();

      // Should show Pro plan and invoice
      await expect(page.locator('text=Pro')).toBeVisible();
      await expect(page.locator('text=$15.00')).toBeVisible();
    });

    test('should handle webhook for subscription cancellation', async ({ page }) => {
      // Mock the billing API endpoint to return cancelled subscription state
      await page.route('/api/me/billing**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentPlan: 'free',
            nextBillingDate: null,
            cardLast4: null,
            cardExpiry: null,
            cancelAtPeriodEnd: true,
            invoices: [],
            usage: {
              bookmarksUsed: 5,
              bookmarksLimit: 500,
              collectionsUsed: 1,
              collectionsLimit: 10,
            },
          }),
        });
      });

      await page.goto('/dashboard/billing');
      await page.reload();

      // Should show Free plan and cancellation notice
      await expect(page.locator('text=Free')).toBeVisible();
      await expect(page.locator('text=Canceled')).toBeVisible();
    });

    test('should handle webhook errors gracefully', async ({ page }) => {
      // Mock the billing API endpoint to return an error
      await page.route('/api/me/billing**', route => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Failed to fetch billing information',
          }),
        });
      });

      // Navigate to billing page which calls the API
      await page.goto('/dashboard/billing');
      await page.reload();

      // Should show error state (billing page has error handling)
      await expect(page.locator('text=Failed to load')).or(page.locator('text=Error')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Session Verification', () => {
    test.beforeEach(async ({ page }) => {
      // Mock SSR-related routes to avoid database queries in E2E test mode
      await page.route('/api/me/billing**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentPlan: 'free',
            nextBillingDate: null,
            cardLast4: null,
            cardExpiry: null,
            invoices: [],
            usage: {
              bookmarksUsed: 0,
              bookmarksLimit: 500,
              collectionsUsed: 0,
              collectionsLimit: 10,
            },
          }),
        });
      });
    });

    test('should verify session with Stripe API', async ({ page }) => {
      // Mock successful verification
      await page.route('/api/stripe/verify-session**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Subscription activated!',
            plan: 'pro',
          }),
        });
      });

      await page.goto('/upgrade-success?session_id=mock_verify_session&plan=pro');
      await page.reload();

      // Should show upgrade success
      await expect(page.locator('text=Upgrade Successful')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=Pro')).toBeVisible({ timeout: 15000 });
    });

    test('should handle invalid session ID', async ({ page }) => {
      // Mock error response
      await page.route('/api/stripe/verify-session**', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid session ID',
          }),
        });
      });

      await page.goto('/upgrade-success?session_id=invalid_session&plan=pro');
      await page.reload();

      // Should show error
      await expect(page.locator('text=Something Went Wrong')).toBeVisible({ timeout: 15000 });
    });

    test('should handle pending payment status', async ({ page }) => {
      // Mock pending payment
      await page.route('/api/stripe/verify-session**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Payment pending',
          }),
        });
      });

      await page.goto('/upgrade-success?session_id=pending_session&plan=pro');
      await page.reload();

      // Should show loading state
      await expect(page.locator('text=Processing Your Subscription')).toBeVisible({ timeout: 10000 });
    });

    test('should handle payment failure', async ({ page }) => {
      // Mock payment failure
      await page.route('/api/stripe/verify-session**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            message: 'Payment failed',
          }),
        });
      });

      await page.goto('/upgrade-success?session_id=failed_session&plan=pro');
      await page.reload();

      // Should show error
      await expect(page.locator('text=Something Went Wrong')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Subscription Status Updates', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/pricing');
    });

    test('should update plan after successful webhook', async ({ page }) => {
      // Mock verify-session endpoint
      await page.route('/api/stripe/verify-session**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            message: 'Plan changed to pro',
            plan: 'pro',
          }),
        });
      });

      // Mock billing endpoint to return Pro plan
      await page.route('/api/me/billing**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentPlan: 'pro',
            nextBillingDate: '2025-02-01',
            cardLast4: '4242',
            cardExpiry: '12/25',
            invoices: [],
            usage: {
              bookmarksUsed: 10,
              bookmarksLimit: -1,
              collectionsUsed: 2,
              collectionsLimit: -1,
            },
          }),
        });
      });

      await page.goto('/upgrade-success?session_id=mock_session&plan=pro');
      await page.reload();

      // Navigate to billing page to verify plan update
      await page.goto('/dashboard/billing');
      await page.reload();

      // Should show Pro plan
      await expect(page.locator('text=Pro')).toBeVisible();
    });

    test('should downgrade plan after cancellation webhook', async ({ page }) => {
      // Mock billing endpoint to return Free plan with cancellation
      await page.route('/api/me/billing**', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            currentPlan: 'free',
            nextBillingDate: null,
            cardLast4: null,
            cardExpiry: null,
            invoices: [],
            cancelAtPeriodEnd: true,
            usage: {
              bookmarksUsed: 5,
              bookmarksLimit: 500,
              collectionsUsed: 1,
              collectionsLimit: 10,
            },
          }),
        });
      });

      await page.goto('/dashboard/billing');
      await page.reload();

      // Should show Free plan
      await expect(page.locator('text=Free')).toBeVisible();
    });
  });
});

