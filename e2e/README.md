# E2E Test Suite for MimeBookmark

This directory contains comprehensive end-to-end (E2E) tests for the MimeBookmark application using Playwright.

## Test Coverage

### Pages Tested
1. **Home Page** (`home.spec.ts`) - Landing page with navigation
2. **Login Page** (`login.spec.ts`) - User authentication
3. **Register Page** (`register.spec.ts`) - User registration
4. **Dashboard Page** (`dashboard.spec.ts`) - Main dashboard (requires auth)
5. **Collections Page** (`collections.spec.ts`) - Collection management (requires auth)
6. **Bookmarks Page** (`bookmarks.spec.ts`) - Bookmark management (requires auth)
7. **Tags Page** (`tags.spec.ts`) - Tag management (requires auth)
8. **Settings Page** (`settings.spec.ts`) - User settings (requires auth)
9. **Navigation** (`navigation.spec.ts`) - Sidebar and page navigation
10. **API Endpoints** (`api.spec.ts`) - Backend API authentication
11. **Accessibility** (`accessibility.spec.ts`) - A11y and performance tests

## Running Tests

### Install Dependencies
```bash
npm install
npx playwright install chromium
```

### Run All Tests
```bash
npx playwright test --project=chromium
```

### Run Specific Test File
```bash
npx playwright test e2e/home.spec.ts --project=chromium
```

### Run Tests with UI
```bash
npx playwright test --project=chromium --ui
```

### Run Tests in Debug Mode
```bash
npx playwright test e2e/home.spec.ts --project=chromium --debug
```

## Test Configuration

### Playwright Config (`playwright.config.ts`)
- **Base URL**: http://localhost:3000 (configurable)
- **Browser**: Chromium (default), Firefox, WebKit available
- **Retries**: 2 retries on CI, 0 locally
- **Reporters**: HTML (default), list, line, JSON available

### Environment Variables
```bash
# Optional: Override base URL
BASE_URL=http://localhost:3002

# Optional: CI environment
CI=true
```

## Test Structure

### Describe Blocks
Each test file uses Playwright's `test.describe()` to group related tests:
- **BeforeEach**: Setup and page navigation
- **Core Functionality**: Main user journeys
- **Edge Cases**: Error handling and validation
- **Responsive Design**: Mobile/tablet viewport tests

### Test Patterns
```typescript
test.describe('Page Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/page-route');
  });

  test('should display key elements', async ({ page }) => {
    await expect(page.locator('selector')).toBeVisible();
  });
});
```

## Authentication Handling

### Public Pages (No Auth Required)
- Home page (`/`)
- Login page (`/login`)
- Register page (`/register`)

### Protected Pages (Auth Required)
- Dashboard (`/dashboard/*`)
- Collections, Bookmarks, Tags, Settings

**Note**: Some tests may require mock authentication or manual login depending on test requirements.

## Best Practices

### Writing Tests
1. **Use descriptive names**: `should display error for invalid email`
2. **Test user flows**: Don't just test elements, test journeys
3. **Handle async**: Use `await` and proper waiting strategies
4. **Be specific**: Use precise selectors to avoid flaky tests
5. **Test mobile**: Include responsive viewport tests

### Selectors
```typescript
// Good
await page.locator('button:has-text("Submit")').click();
await page.locator('input[id="email"]').fill('test@example.com');

// Avoid
await page.locator('.btn-primary').click(); // Too generic
await page.locator('div:nth-child(2) > span').click(); // Brittle
```

### Waiting
```typescript
// Good: Use built-in assertions
await expect(page.locator('text=Success')).toBeVisible();

// Good: Use explicit waits
await page.waitForSelector('.loading-spinner', { state: 'hidden' });

// Avoid: Arbitrary sleeps
await page.waitForTimeout(5000); // Never do this
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test --project=chromium
```

## Troubleshooting

### Common Issues

1. **Tests timing out**
   - Check if the development server is running
   - Increase timeout in test options: `test.setTimeout(60000)`

2. **Element not found**
   - Verify the selector is correct
   - Check if the element is in a shadow DOM
   - Ensure page has fully loaded

3. **Authentication failures**
   - Tests for protected pages require authentication setup
   - Check test setup and mocking configuration

### Debug Mode
Use Playwright's debug mode to inspect tests:
```bash
npx playwright test e2e/login.spec.ts --project=chromium --debug
```

## Coverage Metrics

### Pages Coverage
- ✅ Home: 100% (7/7 tests passing)
- ✅ Login: 100% (10/10 tests passing)
- ✅ Register: 100% (9/9 tests passing)
- ⚠️ Dashboard: Partial (auth required)
- ⚠️ Settings: Partial (auth required)
- ⚠️ Collections: Partial (auth required)
- ⚠️ Bookmarks: Partial (auth required)
- ⚠️ Tags: Partial (auth required)

### Features Coverage
- ✅ Authentication flow
- ✅ Form validation
- ✅ Navigation
- ✅ Responsive design
- ✅ Accessibility
- ⚠️ CRUD operations (require auth)
- ✅ API security (401 handling)

## Continuous Improvement

### Adding New Tests
1. Create test file following existing patterns
2. Add comprehensive test cases
3. Include both positive and negative scenarios
4. Test edge cases and error conditions
5. Ensure mobile responsiveness

### Test Maintenance
- Review failing tests weekly
- Update selectors when components change
- Refactor flaky tests
- Add new tests for new features
