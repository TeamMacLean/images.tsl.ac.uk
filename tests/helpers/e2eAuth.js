/**
 * Sign-in helper for the Playwright specs.
 *
 * Most of the authenticated tests in this suite used to check whether they had
 * been bounced to /signin and skip themselves if so — which, since nothing ever
 * signed them in, meant they always skipped and never asserted anything. This
 * signs in properly: submitting the real form carries the CSRF token with it.
 *
 * Against a developmentMode server any credentials work. Against a real one,
 * set TEST_USERNAME and TEST_PASSWORD.
 */
async function signIn(page) {
  const username = process.env.TEST_USERNAME || "testuser";
  const password = process.env.TEST_PASSWORD || "testpassword";

  await page.goto("/signin");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('form[action="/signin"] button');
  await page.waitForLoadState("networkidle");

  return !page.url().includes("/signin");
}

/**
 * Sign in, or skip the test if this server will not accept our credentials
 * (a real LDAP-backed deployment with no TEST_USERNAME set).
 */
async function signInOrSkip(page, test) {
  const ok = await signIn(page);
  if (!ok) {
    test.skip(
      true,
      "Could not sign in. Run against a developmentMode server, or set TEST_USERNAME and TEST_PASSWORD.",
    );
  }
  return ok;
}

module.exports = { signIn, signInOrSkip };
