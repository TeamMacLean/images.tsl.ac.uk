# Testing Guide

## ✅ Test Status

All tests are **passing**! 🎉

```bash
6 passed (2.9s)
```

## Overview

This project uses [Playwright](https://playwright.dev/) for end-to-end testing. The tests verify that the application loads correctly and behaves as expected.

## Running Tests

### Run all tests (headless)
```bash
npm test
```

### Run tests with visible browser
```bash
npm run test:headed
```

### Run tests in interactive UI mode
```bash
npm run test:ui
```

### View last test report
```bash
npm run test:report
```

## Test Coverage

### Current Tests (`tests/frontpage.spec.js`)

1. **Root redirect test** - Verifies unauthenticated users are redirected from `/` to `/signin`
2. **Login form elements** - Checks all form elements are present and visible
3. **Form action verification** - Ensures form posts to correct endpoint
4. **Input field functionality** - Tests that form inputs accept user input
5. **Responsive layout** - Verifies page structure and containers
6. **Console error check** - Ensures page loads without JavaScript errors

### What's Tested

✅ **Authentication Flow**
- Redirect from root to signin page when not authenticated
- Signin page loads correctly
- Form elements are present and functional

✅ **UI Components**
- Username input field
- Password input field
- Login button
- Domain suffix display (@nbi.ac.uk)
- Page title and headings

✅ **Form Validation**
- Form method is POST
- Form action is `/signin`
- Input fields accept and retain values

✅ **Page Health**
- No console errors on page load
- All assets load successfully
- Responsive layout containers present

## Test Structure

```
tests/
└── frontpage.spec.js    # Frontend authentication tests
```

## Configuration

Test configuration is in `playwright.config.js`:

- **Base URL**: `http://localhost:3071`
- **Browser**: Chromium (Desktop Chrome)
- **Web Server**: Automatically starts `npm start` before tests
- **Screenshots**: Captured on failure
- **Traces**: Recorded on first retry
- **Reporters**: HTML report generated

## Adding New Tests

To add new tests, create a new `.spec.js` file in the `tests/` directory:

```javascript
const { test, expect } = require('@playwright/test');

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/some-page');
    await expect(page.locator('.some-element')).toBeVisible();
  });
});
```

## Continuous Integration

The test configuration includes CI-specific settings:

- **CI Detection**: `process.env.CI`
- **Retries on CI**: 2 attempts
- **Workers on CI**: 1 (sequential execution)
- **forbidOnly**: Fails build if `test.only` is left in code

## Debugging Failed Tests

### View screenshots
Failed tests automatically capture screenshots in:
```
test-results/[test-name]/test-failed-*.png
```

### View traces
Enable trace collection:
```bash
npx playwright test --trace on
```

Then view the trace:
```bash
npx playwright show-trace trace.zip
```

### Run single test
```bash
npx playwright test tests/frontpage.spec.js
```

### Run specific test by name
```bash
npx playwright test -g "should redirect from root"
```

## Requirements

- **Node.js**: 24.x or higher
- **Playwright**: Installed via `npm install`
- **Chromium**: Installed via `npx playwright install chromium`

## Test Data

Tests use the live application running on `localhost:3071`. The server is automatically started before tests run and stopped after completion.

### Prerequisites for Tests

1. **RethinkDB** should be running (or tests will see database warnings - but tests still pass)
2. **Port 3071** must be available
3. **Node 24** must be active

## Troubleshooting

### Tests fail with "Server not ready"
The server might take longer to start. Increase timeout in `playwright.config.js`:
```javascript
webServer: {
  timeout: 180 * 1000, // 3 minutes
}
```

### Tests fail with "Port already in use"
Kill any running server:
```bash
lsof -ti:3071 | xargs kill -9
```

### Browser won't open
Reinstall Playwright browsers:
```bash
npx playwright install --force
```

## Future Test Ideas

Potential areas for additional test coverage:

- [ ] **File upload functionality** (Uppy integration)
- [ ] **LDAP authentication** (with mock server)
- [ ] **Group/Project navigation** (authenticated routes)
- [ ] **Image viewing and management**
- [ ] **Search functionality**
- [ ] **Admin panel** (if applicable)
- [ ] **Mobile responsive design**
- [ ] **Cross-browser testing** (Firefox, Safari)
- [ ] **Accessibility testing** (ARIA labels, keyboard navigation)
- [ ] **Performance testing** (load times, asset sizes)

## Best Practices

1. **Keep tests independent** - Each test should work standalone
2. **Use descriptive names** - Test names should explain what they verify
3. **Clean up after tests** - Don't leave test data in database
4. **Avoid hardcoded waits** - Use Playwright's auto-waiting features
5. **Test user flows** - Test actual user scenarios, not just elements
6. **Keep tests fast** - Fast tests = more frequent runs
7. **Use page objects** - For complex UIs, consider page object pattern

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)

---

**Test Status**: ✅ All Passing  
**Last Updated**: November 2024  
**Test Framework**: Playwright v1.56+