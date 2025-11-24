const { test, expect } = require("@playwright/test");

test.describe("Help Popup Tests", () => {
  // Helper function to perform login if needed
  async function loginIfNeeded(page) {
    // Check if we're on the signin page
    if (page.url().includes("/signin")) {
      // Mock authentication or skip test
      const testUsername = process.env.TEST_USERNAME || "";
      const testPassword = process.env.TEST_PASSWORD || "";

      if (testUsername && testPassword) {
        await page.fill('input[name="username"]', testUsername);
        await page.fill('input[name="password"]', testPassword);
        await page.click('button:has-text("Login")');
        await page.waitForLoadState("networkidle");
      } else {
        // Try mock authentication with cookies
        await page.context().addCookies([
          {
            name: "connect.sid",
            value: "test-session-id",
            domain: "localhost",
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ]);
      }
    }
  }

  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for popup tests
    test.setTimeout(30000);
  });

  test("should have openHelp function defined globally", async ({ page }) => {
    // Navigate to any page that includes head.ejs
    await page.goto("/signin");

    // Check that openHelp function is defined
    const isOpenHelpDefined = await page.evaluate(() => {
      return typeof window.openHelp === "function";
    });

    expect(isOpenHelpDefined).toBe(true);
  });

  test("should open help popup from new project page", async ({ page, context }) => {
    // Setup mock authentication
    await page.context().addCookies([
      {
        name: "connect.sid",
        value: "test-session-id",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Navigate to new project page (using a test group)
    await page.goto("/browse/test-group/new").catch(async () => {
      // If the group doesn't exist or we're redirected, skip this test
      if (page.url().includes("/signin")) {
        test.skip(true, "Requires authentication and valid group");
        return;
      }
    });

    // Skip if we're not on the project page
    if (!page.url().includes("/new")) {
      test.skip(true, "Could not access new project page");
      return;
    }

    // Listen for the popup event
    const popupPromise = context.waitForEvent("page");

    // Find and click the "read more" link
    const readMoreLink = page.locator('a:has-text("read more")').first();

    if (await readMoreLink.isVisible()) {
      // Click the read more link
      await readMoreLink.click();

      // Wait for the popup to open
      const popup = await popupPromise;

      // Wait for the popup to load
      await popup.waitForLoadState("networkidle");

      // Verify the popup URL
      expect(popup.url()).toContain("/help");

      // Check that the help page loaded without errors
      const title = await popup.locator("h1.title").textContent();
      expect(title).toContain("Help");

      // Check for key content in the popup
      await expect(popup.locator('h2:has-text("Naming stuff")')).toBeVisible();
      await expect(popup.locator('li:has-text("Project")')).toBeVisible();
      await expect(popup.locator('li:has-text("Sample")')).toBeVisible();
      await expect(popup.locator('li:has-text("Experiment")')).toBeVisible();
      await expect(popup.locator('li:has-text("Capture")')).toBeVisible();

      // Verify the mailto link is correct
      const emailLink = popup.locator('a[href^="mailto:"]');
      if (await emailLink.isVisible()) {
        const href = await emailLink.getAttribute("href");
        expect(href).toBe("mailto:bioinformatics@tsl.ac.uk");

        const text = await emailLink.textContent();
        expect(text).toBe("bioinformatics@tsl.ac.uk");
      }

      // Close the popup
      await popup.close();
    } else {
      test.skip(true, "Read more link not visible");
    }
  });

  test("should render help page correctly in popup window", async ({ page, context }) => {
    // Navigate directly to help page in a popup context
    const popup = await context.newPage();

    // Add authentication cookies
    await popup.context().addCookies([
      {
        name: "connect.sid",
        value: "test-session-id",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Navigate to help page
    await popup.goto("/help");

    // Skip if redirected to signin
    if (popup.url().includes("/signin")) {
      test.skip(true, "Requires authentication");
      return;
    }

    // Set viewport to popup dimensions
    await popup.setViewportSize({ width: 520, height: 570 });

    // Check that content renders correctly in smaller viewport
    await expect(popup.locator("h1.title")).toBeVisible();

    // Check that all sections are present
    const sections = ["Project", "Sample", "Experiment", "Capture"];
    for (const section of sections) {
      await expect(popup.locator(`h3:has-text("${section}")`)).toBeVisible();
    }

    // Check that the image scales properly
    const image = popup.locator('img[src="/img/images_data_model.png"]');
    if (await image.isVisible()) {
      const box = await image.boundingBox();
      // Image should not exceed popup width
      expect(box.width).toBeLessThanOrEqual(520);
    }

    // Check for the contact card
    await expect(popup.locator(".card")).toBeVisible();

    await popup.close();
  });

  test("should handle mailto link correctly", async ({ page }) => {
    // Setup mock authentication
    await page.context().addCookies([
      {
        name: "connect.sid",
        value: "test-session-id",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/help");

    if (page.url().includes("/signin")) {
      test.skip(true, "Requires authentication");
      return;
    }

    // Find the mailto link
    const emailLink = page.locator('a[href^="mailto:"]');

    if (await emailLink.isVisible()) {
      // Verify the href attribute
      const href = await emailLink.getAttribute("href");
      expect(href).toBe("mailto:bioinformatics@tsl.ac.uk");

      // Verify the displayed text
      const text = await emailLink.textContent();
      expect(text).toBe("bioinformatics@tsl.ac.uk");

      // Check that clicking doesn't cause errors
      // We can't actually test the mailto behavior in a headless browser
      // but we can verify no JavaScript errors occur
      const consoleErrors = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          consoleErrors.push(msg.text());
        }
      });

      // Attempt to click (won't actually open email client in test)
      await emailLink.click();

      // Wait a moment for any errors to appear
      await page.waitForTimeout(500);

      // Verify no errors occurred
      expect(consoleErrors).toHaveLength(0);
    }
  });

  test("should test read more links on all relevant pages", async ({ page, context }) => {
    // Setup mock authentication
    await page.context().addCookies([
      {
        name: "connect.sid",
        value: "test-session-id",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // List of pages that should have "read more" links
    const pagesWithReadMore = [
      { path: "/browse/test-group/new", name: "New Project" },
      { path: "/browse/test-group/test-project/new", name: "New Sample" },
      { path: "/browse/test-group/test-project/test-sample/new", name: "New Experiment" },
      { path: "/browse/test-group/test-project/test-sample/test-experiment/new", name: "New Capture" },
    ];

    const results = [];

    for (const pageInfo of pagesWithReadMore) {
      try {
        await page.goto(pageInfo.path, { waitUntil: "domcontentloaded" });

        // Skip if redirected to signin or 404
        if (page.url().includes("/signin") || page.url().includes("404")) {
          results.push({ page: pageInfo.name, status: "skipped", reason: "not accessible" });
          continue;
        }

        // Look for read more link
        const readMoreLink = page.locator('a:has-text("read more")').first();

        if (await readMoreLink.isVisible()) {
          // Check that onclick attribute calls openHelp
          const onclick = await readMoreLink.getAttribute("onclick");
          expect(onclick).toContain("openHelp");

          results.push({ page: pageInfo.name, status: "passed", hasReadMore: true });
        } else {
          results.push({ page: pageInfo.name, status: "no link found" });
        }
      } catch (error) {
        results.push({ page: pageInfo.name, status: "error", error: error.message });
      }
    }

    // Log results for debugging
    console.log("Read More Link Test Results:", JSON.stringify(results, null, 2));

    // At least one page should have a working read more link
    const passedPages = results.filter(r => r.status === "passed");
    expect(passedPages.length).toBeGreaterThan(0);
  });

  test("should not have JavaScript errors when opening help popup", async ({ page, context }) => {
    // Track console errors
    const errors = [];

    // Setup mock authentication
    await page.context().addCookies([
      {
        name: "connect.sid",
        value: "test-session-id",
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    // Try to navigate to a page with read more link
    await page.goto("/browse/test-group/new").catch(() => {
      // Ignore navigation errors
    });

    if (page.url().includes("/signin")) {
      test.skip(true, "Requires authentication");
      return;
    }

    // Set up error monitoring for both main page and popup
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push({ source: "main", text: msg.text() });
      }
    });

    page.on("pageerror", (error) => {
      errors.push({ source: "main", text: error.message });
    });

    // Look for read more link
    const readMoreLink = page.locator('a:has-text("read more")').first();

    if (await readMoreLink.isVisible()) {
      // Listen for popup
      const popupPromise = context.waitForEvent("page");

      // Click to open popup
      await readMoreLink.click();

      // Get the popup
      const popup = await popupPromise;

      // Monitor popup for errors
      popup.on("console", (msg) => {
        if (msg.type() === "error") {
          errors.push({ source: "popup", text: msg.text() });
        }
      });

      popup.on("pageerror", (error) => {
        errors.push({ source: "popup", text: error.message });
      });

      // Wait for popup to load
      await popup.waitForLoadState("networkidle");

      // Wait a moment for any delayed errors
      await popup.waitForTimeout(1000);

      // Close popup
      await popup.close();
    }

    // Check for any errors
    if (errors.length > 0) {
      console.log("JavaScript errors found:", JSON.stringify(errors, null, 2));
    }

    // Assert no errors
    expect(errors).toHaveLength(0);
  });

  test("should verify popup window dimensions", async ({ page, context }) => {
    await page.goto("/signin");

    // Execute the openHelp function and capture the window.open parameters
    const popupParams = await page.evaluate(() => {
      // Override window.open to capture parameters
      let capturedParams = null;
      const originalOpen = window.open;
      window.open = function(url, target, features) {
        capturedParams = { url, target, features };
        return null; // Don't actually open the window
      };

      // Call openHelp
      if (typeof window.openHelp === "function") {
        window.openHelp();
      }

      // Restore original
      window.open = originalOpen;

      return capturedParams;
    });

    // Verify the popup parameters
    expect(popupParams).not.toBeNull();
    expect(popupParams.url).toBe("/help");
    expect(popupParams.target).toBe("_blank");
    expect(popupParams.features).toContain("height=570");
    expect(popupParams.features).toContain("width=520");
    expect(popupParams.features).toContain("scrollbars=yes");
    expect(popupParams.features).toContain("status=yes");
    expect(popupParams.features).toContain("location=yes");
  });
});
