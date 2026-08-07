// Secrets that have shipped in config.example.js or been used in development.
// Anyone can read these from the repo, so they must never reach production.
const KNOWN_WEAK_SECRETS = ["keyboard cats!", "iamcoolyes", "test-secret", "secret"];

const MIN_SECRET_LENGTH = 32;

/**
 * Inspect the configuration for settings that are dangerous in production.
 *
 * The worst of them is developmentMode, which accepts any username with no
 * password at all. Leaving it on in production is a total authentication
 * bypass, and nothing in the app would otherwise tell you it had happened.
 *
 * @returns {{critical: string[], warnings: string[]}}
 */
function inspect(config) {
  const critical = [];
  const warnings = [];

  if (!config) {
    critical.push("No configuration was loaded at all");
    return { critical, warnings };
  }

  if (config.developmentMode) {
    critical.push(
      "developmentMode is enabled: ANY username signs in with ANY password, " +
        "and every group is readable by everyone",
    );
  }

  const secret = config.secret;
  if (!secret || typeof secret !== "string") {
    critical.push("No session secret is set");
  } else if (KNOWN_WEAK_SECRETS.includes(secret)) {
    critical.push(
      "The session secret is one of the well-known example values: session " +
        "cookies (and their CSRF tokens) can be forged by anyone",
    );
  } else if (secret.length < MIN_SECRET_LENGTH) {
    warnings.push(
      `The session secret is only ${secret.length} characters; use at least ${MIN_SECRET_LENGTH} random ones`,
    );
  }

  if (!Array.isArray(config.groups) || config.groups.length === 0) {
    critical.push("No groups are configured, so nothing can be browsed");
  } else {
    const broken = config.groups
      .filter((g) => g && !Array.isArray(g.groupsWithAccess))
      .map((g) => g.safeName || "(unnamed)");
    if (broken.length) {
      critical.push(
        `These groups have no groupsWithAccess list, so nobody but admins can ` +
          `open them: ${broken.join(", ")}`,
      );
    }
  }

  if (!config.developmentMode) {
    if (!config.ldap || !config.ldap.url) {
      critical.push("No LDAP url is configured, so nobody can sign in");
    } else if (!config.ldap.bindDn || !config.ldap.bindCredentials) {
      warnings.push(
        "LDAP bindDn/bindCredentials are empty; sign in will fail unless the " +
          "directory allows anonymous binds",
      );
    }
  }

  if (!config.rootPath) {
    critical.push("No rootPath is set, so uploads have nowhere to go");
  } else if (!config.rootPath.startsWith("/")) {
    warnings.push(
      `rootPath "${config.rootPath}" is relative, so it depends on the ` +
        "directory the process was started from",
    );
  }

  if (!config.HPCRoot) {
    warnings.push("No HPCRoot is set, so the copyable cluster paths will be wrong");
  }

  if (!Array.isArray(config.admins) || config.admins.length === 0) {
    warnings.push("No admins are configured");
  }

  if (!config.supportWebhook) {
    warnings.push(
      "No supportWebhook is set, so the feedback button is hidden " +
        "(see readme: it is deliberately no longer hardcoded in the page)",
    );
  }

  return { critical, warnings };
}

/**
 * Report on the configuration at boot.
 *
 * Under NODE_ENV=production a critical finding stops the process: it is far
 * better to fail to start than to come up with authentication disabled.
 * Anywhere else it prints and carries on, so development is unaffected.
 */
function report(config, { env = process.env.NODE_ENV, log = console } = {}) {
  const { critical, warnings } = inspect(config);
  const isProduction = env === "production";

  if (critical.length || warnings.length) {
    log.warn("");
    log.warn("=== configuration check ===");
    critical.forEach((m) => log.error(`  CRITICAL: ${m}`));
    warnings.forEach((m) => log.warn(`  warning : ${m}`));
    log.warn("===========================");
    log.warn("");
  }

  if (critical.length && isProduction) {
    log.error(
      `Refusing to start with ${critical.length} critical configuration ` +
        "problem(s) while NODE_ENV=production.",
    );
    return { critical, warnings, fatal: true };
  }

  if (critical.length) {
    log.warn(
      "Continuing despite the above because NODE_ENV is not 'production'. " +
        "Set NODE_ENV=production on the server so these become fatal.",
    );
  }

  return { critical, warnings, fatal: false };
}

module.exports = { inspect, report, KNOWN_WEAK_SECRETS, MIN_SECRET_LENGTH };
