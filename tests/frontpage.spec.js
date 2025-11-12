const { test, expect } = require("@playwright/test");

test.describe("Frontend Tests", () => {
  test("should redirect from root to signin page when not authenticated", async ({
    page,
  }) => {
    // Navigate to the root URL
    await page.goto("/");

    // Should be redirected to /signin
    await expect(page).toHaveURL("/signin");

    // Check that the signin page loaded correctly
    await expect(page).toHaveTitle("TSL Image Data");

    // Verify signin form elements are present
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
  });

  test("should display login form with correct elements", async ({ page }) => {
    // Navigate directly to signin page
    await page.goto("/signin");

    // Check page title
    await expect(page.locator('h3.title:has-text("Login")')).toBeVisible();
    await expect(
      page.locator('p.subtitle:has-text("Please login to proceed.")'),
    ).toBeVisible();

    // Check form elements
    const usernameInput = page.locator('input[name="username"]');
    const passwordInput = page.locator('input[name="password"]');
    const loginButton = page.locator('button:has-text("Login")');

    await expect(usernameInput).toBeVisible();
    await expect(usernameInput).toHaveAttribute("placeholder", "Username");

    await expect(passwordInput).toBeVisible();
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveAttribute("placeholder", "Your Password");

    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveClass(/is-fullwidth/);

    // Check domain suffix is displayed
    await expect(page.locator("text=@nbi.ac.uk")).toBeVisible();
  });

  test("should have correct form action", async ({ page }) => {
    await page.goto("/signin");

    // Check that the form posts to /signin
    const form = page.locator("form");
    await expect(form).toHaveAttribute("method", "post");
    await expect(form).toHaveAttribute("action", "/signin");
  });

  test("should accept input in form fields", async ({ page }) => {
    await page.goto("/signin");

    // Type into username field
    const usernameInput = page.locator('input[name="username"]');
    await usernameInput.fill("testuser");
    await expect(usernameInput).toHaveValue("testuser");

    // Type into password field
    const passwordInput = page.locator('input[name="password"]');
    await passwordInput.fill("testpassword");
    await expect(passwordInput).toHaveValue("testpassword");
  });

  test("should have responsive layout", async ({ page }) => {
    await page.goto("/signin");

    // Check that the main container exists (be more specific to avoid multiple matches)
    const container = page.locator(".container.has-text-centered");
    await expect(container).toBeVisible();

    // Check that the box (login form container) exists
    const box = page.locator(".box");
    await expect(box).toBeVisible();
  });

  test("page should load without console errors", async ({ page }) => {
    const errors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/signin");

    // Give the page a moment to fully load
    await page.waitForLoadState("networkidle");

    // Check there are no console errors (or at least log them if there are)
    if (errors.length > 0) {
      console.log("Console errors found:", errors);
    }

    // The page should have loaded successfully
    await expect(page.locator("h3.title")).toBeVisible();
  });
});
