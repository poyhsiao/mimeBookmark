import { test, expect } from '@playwright/test';
import { authenticateUser } from './fixtures/auth';

test.describe('Import/Export Page', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/import-export');
  });

  test('should display page title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Import');
    await expect(page.locator('h1')).toContainText('Export');
  });

  test('should have import section', async ({ page }) => {
    const importSection = page.locator('section:has-text("Import")').first();
    await expect(importSection).toBeVisible();
  });

  test('should have export section', async ({ page }) => {
    const exportSection = page.locator('section:has-text("Export")').first();
    await expect(exportSection).toBeVisible();
  });

  test('should display supported formats info', async ({ page }) => {
    await expect(page.getByText('Supported formats: HTML, JSON, CSV')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'HTML' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'JSON' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'CSV' })).toBeVisible();
  });
});

test.describe('Import Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/import-export');
  });

  test('should have file upload input', async ({ page }) => {
    const fileInput = page.locator('input[type="file"]').first();
    await expect(fileInput).toBeVisible();
  });

  test('should show progress during import', async ({ page }) => {
    let callCount = 0;
    await page.route('**/api/bookmarks/import**', async (route) => {
      callCount++;
      if (callCount === 1) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ job_id: 'test-job-123', status: 'processing', progress: 0 }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ job_id: 'test-job-123', status: 'completed', progress: 100, imported: 10 }),
        });
      }
    });

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'test-bookmarks.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>'),
    });

    await page.locator('button:has-text("Import Bookmarks")').first().click();

    const progressBar = page.locator('[role="progressbar"]').first();
    await expect(progressBar).toBeVisible();
  });

  test('should show import results', async ({ page }) => {
    await page.route('**/api/bookmarks/import**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'test-job-123',
          status: 'completed',
          progress: 100,
          imported: 15,
          skipped: 2,
          errors: [],
        }),
      });
    });

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'test-bookmarks.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>'),
    });

    await page.locator('button:has-text("Import Bookmarks")').first().click();

    await expect(page.getByText(/Import complete/i).first()).toBeVisible({ timeout: 10000 });
    // Check that results section shows import info
    await expect(page.getByText(/bookmarks imported/i).first()).toBeVisible();
  });

  test('should handle import errors gracefully', async ({ page }) => {
    await page.route('**/api/bookmarks/import**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'INVALID_FORMAT',
          message: 'Invalid file format. Please upload a valid bookmark file.',
        }),
      });
    });

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('This is not a valid bookmark file'),
    });

    await page.locator('button:has-text("Import Bookmarks")').first().click();

    await expect(page.getByText(/Invalid file format/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should have overwrite option', async ({ page }) => {
    const overwriteCheckbox = page.getByRole('checkbox', { name: /Overwrite existing bookmarks with same URL/i });
    await expect(overwriteCheckbox).toBeVisible();
    await expect(overwriteCheckbox).not.toBeChecked();
  });

  test('should allow enabling overwrite option', async ({ page }) => {
    const overwriteCheckbox = page.getByRole('checkbox', { name: /Overwrite existing bookmarks with same URL/i });
    await overwriteCheckbox.click();
    await expect(overwriteCheckbox).toBeChecked();
  });
});

test.describe('Export Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/import-export');
  });

  test('should have export format selection', async ({ page }) => {
    const formatSelector = page.locator('select#format');
    await expect(formatSelector).toBeVisible();
  });

  test('should support HTML export format', async ({ page }) => {
    const formatSelector = page.locator('select').first();
    await formatSelector.selectOption('html');
    await expect(page.getByRole('combobox')).toContainText('HTML');
  });

  test('should support JSON export format', async ({ page }) => {
    const formatSelector = page.locator('select').first();
    await formatSelector.selectOption('json');
    await expect(page.getByRole('combobox')).toContainText('JSON');
  });

  test('should have export button', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export")').first();
    await expect(exportButton).toBeVisible();
  });

  test('should initiate download when export is clicked', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.route('**/api/bookmarks/export**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        headers: {
          'Content-Disposition': 'attachment; filename="bookmarks.html"',
        },
        body: '<!DOCTYPE html><html><head><title>Bookmarks</title></head><body></body></html>',
      });
    });

    await page.locator('button:has-text("Export")').first().click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('bookmarks.html');
  });

  test('should show export options', async ({ page }) => {
    const optionsSection = page.locator('fieldset:has-text("Options")').first();
    await expect(optionsSection).toBeVisible();
  });

  test('should have include tags option', async ({ page }) => {
    const includeTagsOption = page.locator('label:has-text("Include tags")').first();
    await expect(includeTagsOption).toBeVisible();
  });

  test('should have include collections option', async ({ page }) => {
    const includeCollectionsOption = page.locator('label:has-text("Include collections")').first();
    await expect(includeCollectionsOption).toBeVisible();
  });
});

test.describe('Import/Export Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateUser(page);
    await page.goto('/dashboard/import-export');
  });

  test('should handle network errors during import', async ({ page }) => {
    await page.route('**/api/bookmarks/import**', (route) => {
      route.abort('failed');
    });

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'test-bookmarks.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>'),
    });

    await page.locator('button:has-text("Import Bookmarks")').first().click();

    await expect(page.getByText(/Import failed/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should handle duplicate URLs during import', async ({ page }) => {
    await page.route('**/api/bookmarks/import**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          job_id: 'test-job',
          status: 'completed',
          progress: 100,
          imported: 8,
          skipped: 5,
          duplicate_urls: ['https://example.com/1', 'https://example.com/2'],
        }),
      });
    });

    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'test-bookmarks.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<!DOCTYPE html><html><head><title>Test</title></head><body></body></html>'),
    });

    await page.locator('button:has-text("Import Bookmarks")').first().click();

    await expect(page.getByText(/Import complete/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/duplicates skipped/i).first()).toBeVisible();
  });
});

test.describe('Import/Export Mobile Responsiveness', () => {
  test('should display import/export page on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await authenticateUser(page);
    await page.goto('/dashboard/import-export');
    await expect(page.locator('h1')).toContainText('Import');
  });

  test('should stack import and export sections on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await authenticateUser(page);
    await page.goto('/dashboard/import-export');

    const importSection = page.locator('section').first();
    const exportSection = page.locator('section').nth(1);

    await expect(importSection).toBeVisible();
    await expect(exportSection).toBeVisible();
  });
});
