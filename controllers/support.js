const axios = require("axios");
const config = require("../config");

// The widget sends one short message at a time. A cap keeps the relay from being
// useful for flooding the chat channel.
const MAX_MESSAGE_LENGTH = 4000;

// Per-client budget. In-memory is enough: this runs as a single process, and the
// worst case of losing the counters on restart is a few extra messages.
// Generous, because a whole lab can sit behind one address and a burst of real
// reports during an outage must not be swallowed.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 20;
const hits = new Map();

function rateLimited(key, now = Date.now()) {
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);

  // Keep the map from growing without bound.
  if (hits.size > 1000) {
    for (const [k, times] of hits) {
      if (!times.some((t) => now - t < WINDOW_MS)) hits.delete(k);
    }
  }
  return false;
}

module.exports = {
  /** Clear the rate-limit counters. For tests, which all share one address. */
  _resetRateLimit: () => hits.clear(),

  /** Exposed so tests do not have to hardcode the limit. */
  _limits: { WINDOW_MS, MAX_PER_WINDOW, MAX_MESSAGE_LENGTH },

  /**
   * Relay a feedback message to the chat webhook.
   *
   * The webhook URL used to be written into every page by views/foot.ejs, which
   * handed a working credential to anyone who viewed source: they could post to
   * the channel forever, and it could not be revoked without rotating it. It now
   * lives only in config on the server, and the browser talks to this instead.
   *
   * Exempt from CSRF (see lib/csrf.js) because the third-party widget bundle
   * cannot send a token. It is therefore capped and rate limited, and it writes
   * nothing to the database.
   */
  feedback: (req, res) => {
    if (!config.supportWebhook) {
      console.warn("Feedback submitted but no supportWebhook is configured");
      return res.status(503).json({ ok: false, error: "Feedback is not configured" });
    }

    const key = req.ip || "unknown";
    if (rateLimited(key)) {
      return res
        .status(429)
        .json({ ok: false, error: "Too many messages, please try again later" });
    }

    // The widget posts `payload=<json>` form-encoded, which is the legacy chat
    // webhook shape. Accept a plain JSON body too, in case it ever changes.
    let payload = req.body && req.body.payload;
    if (!payload && req.body && typeof req.body === "object" && req.body.text) {
      payload = JSON.stringify({ text: req.body.text });
    }

    if (typeof payload !== "string" || payload.length === 0) {
      return res.status(400).json({ ok: false, error: "No message supplied" });
    }
    if (payload.length > MAX_MESSAGE_LENGTH) {
      return res.status(413).json({ ok: false, error: "Message too long" });
    }

    let text;
    try {
      const parsed = JSON.parse(payload);
      text = typeof parsed.text === "string" ? parsed.text : null;
    } catch (err) {
      return res.status(400).json({ ok: false, error: "Malformed message" });
    }
    if (!text) {
      return res.status(400).json({ ok: false, error: "No message supplied" });
    }

    // Attribute the message rather than trusting whatever the page said.
    const who =
      req.user && req.user.username ? req.user.username : "a signed-out visitor";

    axios
      .post(
        config.supportWebhook,
        new URLSearchParams({
          payload: JSON.stringify({ text: `[${config.appName}] from ${who}: ${text}` }),
        }).toString(),
        {
          headers: { "content-type": "application/x-www-form-urlencoded" },
          timeout: 10000,
        },
      )
      .then(() => {
        // The widget asks for JSON; the webhook itself answers with plain "ok".
        return res.json({ ok: true });
      })
      .catch((err) => {
        console.error("Failed to relay feedback:", err.message);
        return res
          .status(502)
          .json({ ok: false, error: "Could not deliver the message" });
      });
  },
};
