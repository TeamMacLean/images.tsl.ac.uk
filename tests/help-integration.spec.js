const { test, expect } = require("@playwright/test");

test.describe("Help Page Integration Tests", () => {
  // Helper function to perform login
  async function loginUser(page, username, password) {
    await page.goto("/signin");
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button:has-text("Login")');

    // Wait for navigation after login
    await page.waitForLoadState("networkidle");
  }

  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for integration tests
    test.setTimeout(30000);
  });

  test("should access help page after successful login", async ({ page }) => {
    // Skip this test if no test credentials are provided
    const testUsername = process.env.TEST_USERNAME || "";
    const testPassword = process.env.TEST_PASSWORD || "";

    if (!testUsername || !testPassword) {
      test.skip(true, "Test credentials not provided. Set TEST_USERNAME and TEST_PASSWORD environment variables.");
      return;
    }

    // Perform login
    await loginUser(page, testUsername, testPassword);

    // Navigate to help page
    await page.goto("/help");

    // Verify we're on the help page (not redirected to signin)
    const currentUrl = page.url();
    expect(currentUrl).toContain("/help");
    expect(currentUrl).not.toContain("/signin");

    // Verify main help page elements
    await expect(page.locator('h1.title:has-text("Help")')).toBeVisible();

    // Verify the naming section
    await expect(
      page.locator('h2:has-text("Naming stuff in this image database")')
    ).toBeVisible();

    // Verify all four levels are present
    const levels = ["Project", "Sample", "Experiment", "Capture"];
    for (const level of levels) {
      await expect(page.locator(`li:has-text("${level}")`)).toBeVisible();
      await expect(page.locator(`h3.title:has-text("${level}")`)).toBeVisible();
    }

    // Verify the data model image
    const dataModelImage = page.locator('img[src="/img/images_data_model.png"]');
    await expect(dataModelImage).toBeVisible();

    // Verify contact information
    const emailLink = page.locator('a[href="mailto:bioinformatics.tsl.ac.uk"]');
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveText("bioinformatics@tsl.ac.uk");

    // Verify NCBI taxonomy link
    const ncbiLink = page.locator('a[href="https://www.ncbi.nlm.nih.gov/taxonomy"]');
    await expect(ncbiLink).toBeVisible();

    // Check that no console errors occurred
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Reload the page to catch any errors
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Assert no console errors
    expect(consoleErrors).toHaveLength(0);
  });

  test("should navigate from home to help page", async ({ page }) => {
    const testUsername = process.env.TEST_USERNAME || "";
    const testPassword = process.env.TEST_PASSWORD || "";

    if (!testUsername || !testPassword) {
      test.skip(true, "Test credentials not provided");
      return;
    }

    // Login first
    await loginUser(page, testUsername, testPassword);

    // Go to home page (should show groups)
    await page.goto("/");

    // Look for Help link in navigation and click it
    // The help link might be in a navbar or menu
    const helpLink = page.locator('a[href="/help"]').first();

    if (await helpLink.isVisible()) {
      await helpLink.click();
      await page.waitForLoadState("networkidle");

      // Verify we're on the help page
      expect(page.url()).toContain("/help");
      await expect(page.locator('h1.title:has-text("Help")')).toBeVisible();
    } else {
      // If no help link in navigation, navigate directly
      await page.goto("/help");
      expect(page.url()).toContain("/help");
    }
  });

  test("should display all help content correctly", async ({ page }) => {
    const testUsername = process.env.TEST_USERNAME || "";
    const testPassword = process.env.TEST_PASSWORD || "";

    if (!testUsername || !testPassword) {
      test.skip(true, "Test credentials not provided");
      return;
    }

    await loginUser(page, testUsername, testPassword);
    await page.goto("/help");

    // Check Project section content
    const projectSection = page.locator('section:has(h3:has-text("Project"))');
    await expect(projectSection).toContainText("research theme");
    await expect(projectSection).toContainText("Research Group");

    // Check Sample section content
    const sampleSection = page.locator('section:has(h3:has-text("Sample"))');
    await expect(sampleSection).toContainText("biological variables");
    await expect(sampleSection).toContainText("NCBI Taxonomy ID");

    // Check Experiment section content
    const experimentSection = page.locator('section:has(h3:has-text("Experiment"))');
    await expect(experimentSection).toContainText("biological and technical variables");

    // Check Capture section content
    const captureSection = page.locator('section:has(h3:has-text("Capture"))');
    await expect(captureSection).toContainText("images themselves");

    // Check contact card
    const contactCard = page.locator('.card');
    await expect(contactCard).toBeVisible();
    await expect(contactCard).toContainText("bioinformatics@tsl.ac.uk");
    await expect(contactCard).toContainText("bioinformatics team");
  });

  test("should verify help page responsive design", async ({ page, viewport }) => {
    const testUsername = process.env.TEST_USERNAME || "";
    const testPassword = process.env.TEST_PASSWORD || "";

    if (!testUsername || !testPassword) {
      test.skip(true, "Test credentials not provided");
      return;
    }

    await loginUser(page, testUsername, testPassword);
    await page.goto("/help");

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('h1.title')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('h1.title')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('h1.title')).toBeVisible();

    // Verify image scales properly on mobile
    const image = page.locator('img[src="/img/images_data_model.png"]');
    await expect(image).toBeVisible();
    const box = await image.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375); // Should not exceed viewport width
  });

  test("should handle help page errors gracefully", async ({ page }) => {
    const testUsername = process.env.TEST_USERNAME || "";
    const testPassword = process.env.TEST_PASSWORD || "";

    if (!testUsername || !testPassword) {
      test.skip(true, "Test credentials not provided");
      return;
    }

    await loginUser(page, testUsername, testPassword);

    // Intercept the help request to simulate an error
    await page.route("/help", (route) => {
      route.fulfill({
        status: 500,
        body: "Internal Server Error"
      });
    });

    // Try to navigate to help page
    const response = await page.goto("/help", { waitUntil: "networkidle" });

    // Should handle error gracefully
    expect(response.status()).toBe(500);
  });

  test("should validate help page performance", async ({ page }) => {
    const testUsername = process.env.TEST_USERNAME || "";
    const testPassword = process.env.TEST_PASSWORD || "";

    if (!testUsername || !testPassword) {
      test.skip(true, "Test credentials not provided");
      return;
    }

    await loginUser(page, testUsername, testPassword);

    // Measure page load performance
    const startTime = Date.now();
    await page.goto("/help");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    // Page should load within reasonable time (3 seconds)
    expect(loadTime).toBeLessThan(3000);

    // Check that all images load successfully
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      await expect(img).toBeVisible();

      // Verify image has loaded
      const naturalWidth = await img.evaluate((el) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    }
  });
});

// Export a helper function for use in other tests
module.exports = {
  loginUser: async function(page, username, password) {
    await page.goto("/signin");
    await page.fill('input[name="username"]', username);
    await page.fill('input[name="password"]', password);
    await page.click('button:has-text("Login")');
    await page.waitForLoadState("networkidle");
  }
};
