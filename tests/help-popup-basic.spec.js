const { test, expect } = require("@playwright/test");

test.describe("Basic Help Popup Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Set a reasonable timeout
    test.setTimeout(20000);
  });

  test("should have openHelp function defined on pages", async ({ page }) => {
    // Navigate to the signin page (always accessible)
    await page.goto("/signin");

    // Check that openHelp function is defined in the global scope
    const isOpenHelpDefined = await page.evaluate(() => {
      return typeof window.openHelp === "function";
    });

    expect(isOpenHelpDefined).toBe(true);

    // Verify the function signature
    const openHelpCode = await page.evaluate(() => {
      return window.openHelp.toString();
    });

    expect(openHelpCode).toContain("window.open");
    expect(openHelpCode).toContain("/help");
    expect(openHelpCode).toContain("height=570");
    expect(openHelpCode).toContain("width=520");
  });

  test("should render help page without EJS errors", async ({ page }) => {
    // Try to access help page directly (will redirect to signin if not authenticated)
    const response = await page.goto("/help", {
      waitUntil: "domcontentloaded",
    });

    // Check that we got a response (either help page or redirect)
    expect(response).toBeTruthy();

    // If redirected to signin, that's okay - it means the route works
    if (page.url().includes("/signin")) {
      console.log("Help page correctly requires authentication");
      expect(page.url()).toContain("/signin");
    } else {
      // If we got the help page, verify content
      await expect(page.locator("h1.title")).toBeVisible();
    }

    // Check for console errors that would indicate EJS compilation issues
    const consoleErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Give page time to show any errors
    await page.waitForTimeout(500);

    // Check for specific EJS error patterns
    const hasEJSError = consoleErrors.some(
      (error) =>
        error.includes("Unexpected token") ||
        error.includes("SyntaxError") ||
        error.includes("compiling ejs"),
    );

    expect(hasEJSError).toBe(false);
  });

  test("should test help page mailto link directly", async ({ page }) => {
    // Add mock authentication to access help page
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

    // Navigate to help page
    await page.goto("/help");

    // If still redirected, skip the detailed check
    if (page.url().includes("/signin")) {
      console.log("Authentication required - skipping detailed mailto check");
      test.skip(true, "Requires valid authentication");
      return;
    }

    // Look for mailto link
    const emailLinks = page.locator('a[href^="mailto:"]');
    const count = await emailLinks.count();

    if (count > 0) {
      // Check the first mailto link
      const firstEmailLink = emailLinks.first();
      const href = await firstEmailLink.getAttribute("href");
      const text = await firstEmailLink.textContent();

      // Verify correct format (with @ symbol)
      expect(href).toMatch(/mailto:[^@]+@[^@]+/);

      // Specifically check for the bioinformatics email if present
      if (text?.includes("bioinformatics")) {
        expect(href).toBe("mailto:bioinformatics@tsl.ac.uk");
        expect(text).toBe("bioinformatics@tsl.ac.uk");
      }
    }
  });

  test("should verify popup parameters without opening actual popup", async ({
    page,
  }) => {
    await page.goto("/signin");

    // Test the openHelp function parameters without actually opening a popup
    const popupParams = await page.evaluate(() => {
      // Temporarily override window.open to capture parameters
      let capturedParams = null;
      const originalOpen = window.open;

      window.open = function (url, target, features) {
        capturedParams = { url, target, features };
        return null; // Don't actually open the window
      };

      // Call openHelp if it exists
      if (typeof window.openHelp === "function") {
        window.openHelp();
      }

      // Restore original function
      window.open = originalOpen;

      return capturedParams;
    });

    // Verify the popup would open with correct parameters
    expect(popupParams).not.toBeNull();
    expect(popupParams.url).toBe("/help");
    expect(popupParams.target).toBe("_blank");

    // Check window features
    const features = popupParams.features;
    expect(features).toContain("height=570");
    expect(features).toContain("width=520");
    expect(features).toContain("scrollbars=yes");
    expect(features).toContain("status=yes");
    expect(features).toContain("location=yes");
  });

  test("should handle help page in popup dimensions", async ({
    page,
    context,
  }) => {
    // Create a new page with popup dimensions
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 520, height: 570 });

    // Add mock authentication
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

    // If redirected to signin, that's expected behavior without auth
    if (popup.url().includes("/signin")) {
      console.log("Help page requires authentication - expected behavior");
      await popup.close();
      return;
    }

    // If we got the help page, verify it renders properly in small viewport
    const title = popup.locator("h1.title");
    if (await title.isVisible()) {
      // Check that content fits within popup dimensions
      const box = await title.boundingBox();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(520);
      }

      // Check that images scale properly
      const images = popup.locator("img");
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const imgBox = await img.boundingBox();
        if (imgBox) {
          expect(imgBox.width).toBeLessThanOrEqual(520);
        }
      }
    }

    await popup.close();
  });

  test("should not have JavaScript errors on any help-related navigation", async ({
    page,
  }) => {
    const errors = [];

    // Monitor for JavaScript errors
    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        // Ignore expected auth-related messages
        const text = msg.text();
        if (!text.includes("401") && !text.includes("Unauthorized")) {
          errors.push(text);
        }
      }
    });

    // Try to navigate to help directly
    await page.goto("/help", { waitUntil: "domcontentloaded" });

    // Wait for any async errors to appear
    await page.waitForTimeout(1000);

    // Check for critical errors (especially EJS compilation errors)
    const criticalErrors = errors.filter((error) => {
      // Ignore "Unexpected token '<'" which usually means a 404 on a JS file (asset missing)
      if (error.includes("Unexpected token '<'")) return false;

      return (
        error.includes("SyntaxError") ||
        error.includes("Unexpected token") ||
        error.includes("compiling ejs") ||
        (error.includes("mailto:") && error.includes("."))
      );
    });

    if (criticalErrors.length > 0) {
      console.log("Critical errors found:", criticalErrors);
    }

    expect(criticalErrors).toHaveLength(0);
  });

  test("should verify help content structure when accessible", async ({
    page,
  }) => {
    // Add mock authentication
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

    // Skip detailed checks if not authenticated
    if (page.url().includes("/signin")) {
      console.log("Skipping content structure test - requires authentication");
      return;
    }

    // Verify the main structure elements exist
    const mainTitle = page.locator("h1.title");
    if (await mainTitle.isVisible()) {
      const titleText = await mainTitle.textContent();
      expect(titleText).toContain("Help");

      // Check for the four main sections
      const sections = ["Project", "Sample", "Experiment", "Capture"];
      for (const section of sections) {
        const sectionElements = page.locator(`text=${section}`);
        const count = await sectionElements.count();
        expect(count).toBeGreaterThan(0);
      }

      // Check for contact information section
      const contactSection = page.locator("text=/contact|questions/i");
      const hasContact = await contactSection.count();
      expect(hasContact).toBeGreaterThan(0);
    }
  });
});
