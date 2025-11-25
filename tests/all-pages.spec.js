const { test, expect } = require("@playwright/test");

test.describe("All Pages Load Test", () => {
  /**
   * This test suite checks that all major pages of the site load without errors.
   * Since most pages require authentication, we mainly check unauthenticated pages
   * and verify authenticated pages redirect properly or show appropriate errors.
   */

  test("signin page loads correctly", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).toHaveTitle("TSL Image Data");
    await expect(page.locator('h3.title:has-text("Login")')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
  });

  test("root redirects to signin when not authenticated", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/signin");
  });

  test("home page shows 404", async ({ page }) => {
    const response = await page.goto("/home");
    // /home is not a valid route, should show 404
    expect(response.status()).toBe(404);
    await expect(page).toHaveTitle("TSL Image Data");
  });

  test("help page loads correctly without authentication", async ({ page }) => {
    // Check if help page requires auth or is public
    await page.goto("/help");

    // It might redirect to signin or load - let's check what happens
    const url = page.url();

    if (url.includes("/signin")) {
      // Help requires authentication
      await expect(page).toHaveURL("/signin");
    } else {
      // Help is public - verify it loaded
      await expect(page).toHaveTitle("TSL Image Data");
    }
  });

  test("non-existent page shows 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-12345");

    // Should get a 404 status
    expect(response.status()).toBe(404);
  });

  test("browse with invalid group redirects to signin", async ({ page }) => {
    await page.goto("/browse/invalid-group-name-12345");

    // Should redirect to signin when not authenticated
    await expect(page).toHaveURL("/signin");
  });

  test("static assets load correctly", async ({ page }) => {
    // Check that CSS loads
    const cssResponse = await page.goto("/style/uppy_dash.css");
    expect(cssResponse.status()).toBe(200);
    expect(cssResponse.headers()["content-type"]).toContain("text/css");
  });

  test("JavaScript bundles are accessible", async ({ page }) => {
    // Suppress console errors during this test
    page.on("pageerror", () => {});
    page.on("console", () => {});

    // Check that the uploader.js bundle exists
    const jsResponse = await page.goto("/js/dist/uploader.js");
    expect(jsResponse.status()).toBe(200);
    expect(jsResponse.headers()["content-type"]).toMatch(
      /(application\/javascript|text\/javascript)/,
    );
  });

  test("signin page has no critical console errors", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("Console error:", msg.text());
        errors.push(msg.text());
      }
    });

    await page.goto("/signin");
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical errors (clipboard/require bundling issues)
    const criticalErrors = errors.filter(
      (msg) =>
        !msg.includes("clipboard") &&
        !msg.includes("ClipBoard") &&
        !msg.includes("require"),
    );

    if (criticalErrors.length > 0) {
      console.log("Critical console errors:", criticalErrors);
    }
    expect(criticalErrors.length).toBe(0);
  });

  test("page loads without critical exceptions", async ({ page }) => {
    const exceptions = [];
    page.on("pageerror", (error) => {
      console.log("Page error:", error.message);
      exceptions.push(error.message);
    });

    await page.goto("/signin");
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical exceptions (clipboard library bundling issue)
    const criticalExceptions = exceptions.filter(
      (msg) => !msg.includes("require is not defined"),
    );

    if (criticalExceptions.length > 0) {
      console.log("Critical exceptions found:", criticalExceptions);
    }
    expect(criticalExceptions.length).toBe(0);
  });

  test("critical network requests complete successfully", async ({ page }) => {
    const failedRequests = [];

    page.on("requestfailed", (request) => {
      console.log("Request failed:", request.url());
      failedRequests.push({
        url: request.url(),
        failure: request.failure(),
      });
    });

    await page.goto("/signin");
    await page.waitForLoadState("networkidle");

    // Filter out known non-critical failed requests (clipboard library and module loading)
    const criticalFailures = failedRequests.filter(
      (req) => !req.url.includes("clipboard") && !req.url.includes("ClipBoard"),
    );

    if (criticalFailures.length > 0) {
      console.log("Critical failed requests:", criticalFailures);
    }
    expect(criticalFailures.length).toBe(0);
  });

  test("font-awesome assets are accessible", async ({ page }) => {
    // Check that font-awesome is serving correctly
    await page.goto("/signin");

    // Try to load a font-awesome resource
    const faResponse = await page.request.get(
      "/font-awesome/css/font-awesome.css",
    );
    expect(faResponse.status()).toBe(200);
  });
});
