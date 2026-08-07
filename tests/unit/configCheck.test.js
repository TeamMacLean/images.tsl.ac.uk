const test = require("node:test");
const assert = require("node:assert");

const { stubConfig, testConfig } = require("../helpers/stub");
stubConfig();

const { inspect, report } = require("../../lib/configCheck");

/** A configuration that should pass cleanly. */
function goodConfig(overrides = {}) {
  return {
    ...testConfig(),
    developmentMode: false,
    secret: "a".repeat(64),
    rootPath: "/srv/images",
    HPCRoot: "/hpc/images",
    admins: ["someone"],
    supportWebhook: "https://hooks.example/abc",
    ldap: {
      url: "ldap://dc.example.org:389",
      bindDn: "cn=svc",
      bindCredentials: "hunter2",
    },
    ...overrides,
  };
}

const silent = { warn() {}, error() {} };

test("inspect", async (t) => {
  await t.test("passes a well-formed production config", () => {
    const { critical, warnings } = inspect(goodConfig());
    assert.deepStrictEqual(critical, []);
    assert.deepStrictEqual(warnings, []);
  });

  await t.test("flags developmentMode as critical", () => {
    const { critical } = inspect(goodConfig({ developmentMode: true }));
    assert.strictEqual(critical.length, 1);
    assert.match(critical[0], /developmentMode/);
  });

  await t.test("flags the example secrets as critical", () => {
    for (const secret of ["keyboard cats!", "iamcoolyes"]) {
      const { critical } = inspect(goodConfig({ secret }));
      assert.ok(
        critical.some((m) => /session secret/i.test(m)),
        `"${secret}" was not flagged`,
      );
    }
  });

  await t.test("flags a missing secret as critical", () => {
    const { critical } = inspect(goodConfig({ secret: undefined }));
    assert.ok(critical.some((m) => /session secret/i.test(m)));
  });

  await t.test("warns about a short but unique secret", () => {
    const { critical, warnings } = inspect(goodConfig({ secret: "short-but-mine" }));
    assert.deepStrictEqual(critical, []);
    assert.ok(warnings.some((m) => /characters/.test(m)));
  });

  await t.test("flags a group with no access list as critical", () => {
    const cfg = goodConfig();
    cfg.groups = [{ name: "Broken", safeName: "broken" }];
    const { critical } = inspect(cfg);
    assert.ok(critical.some((m) => /groupsWithAccess/.test(m)));
    assert.ok(critical.some((m) => /broken/.test(m)));
  });

  await t.test("flags having no groups at all", () => {
    const { critical } = inspect(goodConfig({ groups: [] }));
    assert.ok(critical.some((m) => /No groups/.test(m)));
  });

  await t.test("flags a missing LDAP url when not in development", () => {
    const { critical } = inspect(goodConfig({ ldap: {} }));
    assert.ok(critical.some((m) => /LDAP url/.test(m)));
  });

  await t.test("does not require LDAP in development mode", () => {
    const { critical } = inspect(
      goodConfig({ developmentMode: true, ldap: {} }),
    );
    assert.ok(!critical.some((m) => /LDAP url/.test(m)));
  });

  await t.test("warns about a relative rootPath", () => {
    const { warnings } = inspect(goodConfig({ rootPath: "./tmp-dev/images" }));
    assert.ok(warnings.some((m) => /relative/.test(m)));
  });

  await t.test("flags a missing rootPath as critical", () => {
    const { critical } = inspect(goodConfig({ rootPath: undefined }));
    assert.ok(critical.some((m) => /rootPath/.test(m)));
  });

  await t.test("warns when no support webhook is configured", () => {
    const { warnings } = inspect(goodConfig({ supportWebhook: "" }));
    assert.ok(warnings.some((m) => /supportWebhook/.test(m)));
  });

  await t.test("survives no config at all", () => {
    assert.doesNotThrow(() => inspect(undefined));
    assert.ok(inspect(undefined).critical.length > 0);
  });

  await t.test("catches the committed dev config's real problems", () => {
    // The shape of config.js in this repo: development bypass plus a short,
    // publicly-known secret.
    const { critical } = inspect(
      goodConfig({ developmentMode: true, secret: "iamcoolyes" }),
    );
    assert.strictEqual(critical.length, 2);
  });
});

test("report", async (t) => {
  await t.test("is fatal for a critical problem under NODE_ENV=production", () => {
    const result = report(goodConfig({ developmentMode: true }), {
      env: "production",
      log: silent,
    });
    assert.strictEqual(result.fatal, true);
  });

  await t.test("is not fatal outside production", () => {
    const result = report(goodConfig({ developmentMode: true }), {
      env: "development",
      log: silent,
    });
    assert.strictEqual(result.fatal, false);
  });

  await t.test("is not fatal for warnings alone, even in production", () => {
    const result = report(goodConfig({ supportWebhook: "" }), {
      env: "production",
      log: silent,
    });
    assert.strictEqual(result.fatal, false);
  });

  await t.test("is silent when there is nothing to report", () => {
    const lines = [];
    const log = { warn: (m) => lines.push(m), error: (m) => lines.push(m) };
    report(goodConfig(), { env: "production", log });
    assert.deepStrictEqual(lines, []);
  });

  await t.test("names each problem in the output", () => {
    const lines = [];
    const log = { warn: (m) => lines.push(m), error: (m) => lines.push(m) };
    report(goodConfig({ developmentMode: true }), { env: "production", log });
    assert.ok(lines.some((l) => /CRITICAL/.test(l) && /developmentMode/.test(l)));
  });
});
