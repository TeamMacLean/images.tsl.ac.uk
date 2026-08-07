// Copy to config.js and fill in. config.js is gitignored and must stay that way.
//
// Secrets are read from the environment where possible, so the production
// values live in the service definition (systemd EnvironmentFile, pm2 ecosystem
// file, ...) rather than in a file on disk. The fallbacks are development-only
// and are rejected at boot when NODE_ENV=production - see lib/configCheck.js.

module.exports = {
  appName: "Image Data",

  // WARNING: developmentMode accepts ANY username with ANY password and grants
  // access to every group. It must be false in production.
  developmentMode: false,

  rethinkdb: {
    host: process.env.RETHINKDB_HOST || "localhost",
    port: Number(process.env.RETHINKDB_PORT) || 28015,
    db: process.env.RETHINKDB_DB || "imagehog",
  },

  port: process.env.PORT || "3000",

  // Signs session cookies, which now also carry the CSRF token. Use at least 32
  // random characters: `openssl rand -hex 32`. Changing it signs everyone out.
  secret: process.env.SESSION_SECRET || "change-me-in-production",

  // Number of reverse proxies in front of Node. nginx terminating TLS is 1.
  // Wrong value means req.secure and client IPs are wrong.
  trustProxy: Number(process.env.TRUST_PROXY) || 1,

  HPCRoot: "/tsl/data/image", //no trailing slash
  tmpDir: "/storage/uploads/",
  postChangesTo: "",
  tusPath: "/tus",

  ldap: {
    url: process.env.LDAP_URL || "ldap://dc.example.org:389",
    bindDn: process.env.LDAP_BIND_DN || "",
    bindCredentials: process.env.LDAP_BIND_CREDENTIALS || "",
    searchBase: "OU=users,OU=allusers,dc=example,dc=org",
    searchFilter: "(sAMAccountName={{username}})",
  },

  // Chat webhook for the feedback button. Server-side only: it is relayed via
  // POST /support/feedback and never rendered into a page. Leave unset to hide
  // the feedback button entirely.
  supportWebhook: process.env.SUPPORT_WEBHOOK || "",

  uploadTempDir: "/tmp",
  rootPath: "/my_images", //no trailing slash, this is the local path to the root
  admins: ["bob", "steve", "chris"],

  groups: [
    {
      name: "Nick's Group",
      safeName: "ngroup",
      image: "/img/groups/nick.jpg",
      // Must be called groupsWithAccess: this is the list of LDAP group DNs
      // lib/util.js checks membership against.
      groupsWithAccess: [
        "CN=example_group,OU=groups,OU=allgroups,dc=example,dc=org",
      ],
    },
  ],
};
