const crypto = require("crypto");

// Methods that must not change state, and so need no token.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Posted to by the third-party support widget bundle, which cannot be taught to
// send a token. It writes nothing and touches no session; it relays a capped,
// rate-limited message to a chat webhook. See controllers/support.js.
const EXEMPT_PATHS = new Set(["/support/feedback"]);

/** Fetch this session's token, minting one on first use. */
function tokenFor(req) {
  if (!req.session) return "";
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString("hex");
  }
  return req.session.csrfToken;
}

/** Constant-time compare that tolerates differing lengths. */
function matches(supplied, expected) {
  if (typeof supplied !== "string" || typeof expected !== "string") return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Reject state-changing requests that do not carry this session's token.
 *
 * SameSite=Lax on the session cookie already blocks the common cross-site POST,
 * but it is a single control enforced entirely by the browser. This is the
 * second one.
 *
 * Mount after the session middleware and before the router. The tus upload
 * endpoint is mounted ahead of the session and so is untouched; it is not a
 * form POST and carries its own upload URLs.
 */
function csrf(req, res, next) {
  // Every template can render the token, whatever the method.
  res.locals.csrfToken = tokenFor(req);

  if (SAFE_METHODS.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const supplied =
    (req.body && req.body._csrf) ||
    req.get("x-csrf-token") ||
    req.get("x-xsrf-token");

  if (!matches(supplied, req.session && req.session.csrfToken)) {
    console.warn(`Rejected ${req.method} ${req.url}: bad or missing CSRF token`);
    return res.status(403).render("error", {
      error:
        "This form has expired or was submitted from another site. Please reload the page and try again.",
    });
  }

  return next();
}

module.exports = csrf;
module.exports.tokenFor = tokenFor;
