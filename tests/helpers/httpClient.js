const http = require("node:http");

/**
 * Start an Express app on an ephemeral port and return a small client that
 * carries cookies between requests, so tests can sign in and stay signed in.
 */
async function start(app) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const jar = new Map();

  function cookieHeader() {
    return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  function absorb(res) {
    for (const raw of res.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const idx = pair.indexOf("=");
      jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    }
  }

  async function request(pathname, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (jar.size) headers.cookie = cookieHeader();

    const res = await fetch(base + pathname, {
      redirect: "manual",
      ...options,
      headers,
    });
    absorb(res);
    const body = await res.text();
    return { status: res.status, headers: res.headers, body };
  }

  function postFormRaw(pathname, fields) {
    return request(pathname, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
  }

  /**
   * Read the current session's CSRF token off a rendered form. The token is
   * per-session, so any page with a form will do; /signin is always available
   * and is not behind the auth check.
   */
  async function csrfToken(from = "/signin") {
    const res = await request(from, { method: "GET" });
    const match = res.body.match(/name="_csrf"\s+value="([^"]*)"/);
    return match ? match[1] : null;
  }

  return {
    base,
    request,
    get: (p, o) => request(p, { ...o, method: "GET" }),
    csrfToken,
    // Behaves like a browser submitting a rendered form: fetches a fresh token
    // first. Sessions are regenerated on login, so it cannot be cached.
    postForm: async (p, fields) =>
      postFormRaw(p, { ...fields, _csrf: await csrfToken() }),
    // Sends exactly what it is given, for testing the rejection path.
    postFormRaw,
    rawSetCookie: () => jar,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

module.exports = { start };
