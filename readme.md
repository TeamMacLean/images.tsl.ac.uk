# images.tsl.ac.uk
> TSL microscopy image file and metadata storage system.

## Help
* To change the upload limit modify `public/src/uploader:maxFileSize` to be `LIMIT_IN_GB * 1000 * 1000000`. You will also need to modify the reverse proxy (if used), on the tsl server this can be found in `/etc/nginx/conf.d/`
*

## Tests

```bash
yarn test
```

Runs the whole `node:test` suite. No browser and no configuration needed: the
tests stub `config.js` with their own fixture, so they do not depend on the
`config.js` on the machine running them, on LDAP, or on the developer's data.

| command | what it runs |
| --- | --- |
| `yarn test` | everything below except the browser tests |
| `yarn test:unit` | `tests/unit` and `tests/http` — pure logic, views, and the Express app over real HTTP with the models stubbed |
| `yarn test:integration` | `tests/integration` — the thinky model save hooks against a real RethinkDB |
| `yarn test:coverage` | as `yarn test`, with a coverage summary |
| `yarn test:watch` | re-runs on change |
| `yarn test:e2e` | the Playwright browser tests in `tests/*.spec.js` |

Notes:

* **The integration tests skip themselves** when RethinkDB is not listening on
  `localhost:28015`, so `yarn test` stays green on a machine without a database.
  They use a separate `imagehog_test` database and a temporary directory, and
  never touch the `imagehog` database or `rootPath`.
* **Application logging is silenced** during tests. Set `TEST_VERBOSE=1` to get
  it back: `TEST_VERBOSE=1 yarn test`.
* **`yarn test:e2e` needs browsers installed** once per machine:
  ```bash
  yarn playwright install chromium
  ```
  It also needs RethinkDB running, because it drives the real server.

### Layout

```
tests/
  helpers/      stubs for config, the thinky models, and an HTTP client
  unit/         lib/, view rendering, and the access-control middleware
  http/         the real Express app, served over a real socket
  integration/  thinky models against a real RethinkDB
  *.spec.js     Playwright browser tests (run separately, via test:e2e)
```

Playwright owns `*.spec.js`; `node:test` owns `*.test.js`.

CI runs `yarn test` on every push and pull request
(`.github/workflows/test.yml`), with RethinkDB as a service container so the
integration tests run there rather than skipping.

## Configuration

`config.js` is gitignored — copy `config.example.js` and fill it in. Secrets are
read from environment variables there, so production values can live in the
service definition rather than a file on disk:

| variable | purpose |
| --- | --- |
| `SESSION_SECRET` | signs session cookies and their CSRF tokens; ≥32 random chars (`openssl rand -hex 32`) |
| `LDAP_BIND_DN`, `LDAP_BIND_CREDENTIALS`, `LDAP_URL` | directory bind |
| `SUPPORT_WEBHOOK` | chat webhook for the feedback button (see below) |
| `TRUST_PROXY` | number of reverse proxies in front of Node; nginx terminating TLS is `1` |
| `RETHINKDB_HOST`, `RETHINKDB_PORT`, `RETHINKDB_DB`, `PORT` | the obvious |

**Run with `NODE_ENV=production` on the server.** `lib/configCheck.js` inspects
the config at boot and, under `NODE_ENV=production`, *refuses to start* on a
critical problem rather than coming up insecure. The critical ones are:

* `developmentMode: true` — accepts any username with any password and exposes
  every group. A total authentication bypass if it reaches production.
* a session secret that is missing, or one of the known example values
* a group with no `groupsWithAccess` list, or no groups at all
* no LDAP url, or no `rootPath`

Outside production it prints the same report and carries on, so development is
unaffected.

## The feedback button

The support widget's chat webhook is a credential. It used to be written
straight into `views/foot.ejs`, which handed every visitor a working,
unrevocable way to post into the channel. It now lives only in
`config.supportWebhook` on the server, and the browser posts to
`POST /support/feedback`, which relays it.

That endpoint is exempt from CSRF (the third-party widget bundle cannot send a
token), so it is capped at 4000 characters, rate limited per client address, and
writes nothing to the database. It is deliberately reachable without signing in —
someone who *cannot* sign in is exactly who needs to report it.

With no `SUPPORT_WEBHOOK` set the button is simply not rendered.

## Adding a form

Every state-changing request is checked for a CSRF token by `lib/csrf.js`, so
**a new `<form method="post">` must include the token partial** or its
submissions will be refused with a 403:

```ejs
<form method="post" action="...">
    <%-include('../_csrf.ejs') %>
    ...
</form>
```

`tests/http/csrf.test.js` walks every form page and fails if one is missing the
token, so a forgotten include is caught by `yarn test` rather than in the browser.

