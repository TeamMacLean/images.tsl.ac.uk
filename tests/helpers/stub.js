const Module = require("module");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

/**
 * Replace a module in the require cache before anything requires it.
 *
 * The app reaches for `require("../config")` and the thinky-backed models at
 * module load time, so tests need to get in first. This keeps the suite
 * independent of whatever config.js, LDAP server or database happens to be on
 * the machine running it.
 */
function stubModule(request, exports) {
  const resolved = require.resolve(request);
  const stub = new Module(resolved, null);
  stub.filename = resolved;
  stub.loaded = true;
  stub.exports = exports;
  require.cache[resolved] = stub;
  return exports;
}

/** A predictable config, deliberately unlike the developer's local one. */
function testConfig(overrides = {}) {
  return {
    appName: "Test Images",
    // Off, so the real access-control code runs rather than being bypassed.
    developmentMode: false,
    rethinkdb: { host: "localhost", port: 28015, db: "imagehog_test" },
    port: "0",
    secret: "test-secret",
    HPCRoot: "/hpc/images",
    tmpDir: "/tmp",
    tusPath: "/files",
    rootPath: "/tmp/imagehog-test-root",
    admins: ["adminuser"],
    ldap: {
      url: "ldap://localhost:389",
      bindDn: "",
      bindCredentials: "",
      searchBase: "",
      searchFilter: "(sAMAccountName={{username}})",
    },
    groups: [
      {
        name: "Alpha Group",
        safeName: "alpha",
        image: "/img/groups/alpha.jpg",
        groupsWithAccess: ["CN=alpha_modify,OU=groups,DC=example,DC=org"],
      },
      {
        name: "Beta Group",
        safeName: "beta",
        image: "/img/groups/beta.jpg",
        groupsWithAccess: ["CN=beta_modify,OU=groups,DC=example,DC=org"],
      },
    ],
    ...overrides,
  };
}

function stubConfig(overrides) {
  return stubModule(path.join(ROOT, "config.js"), testConfig(overrides));
}

module.exports = { ROOT, stubModule, stubConfig, testConfig };
