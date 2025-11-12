# Migration Guide: Node 12 to Node 24

This document outlines all changes made to upgrade this project from Node 12 to Node 24.

## Summary of Changes

### 1. Node Version
- **Updated `.nvmrc`** from `12.22.7` to `24`
- **Added `engines` field** in `package.json` to specify Node 24+ requirement

### 2. Dependency Upgrades

#### Major Upgrades
- **Uppy packages**: v0.27.x → v3.x
  - `@uppy/core`: ^0.27.3 → ^3.9.0
  - `@uppy/dashboard`: ^0.27.5 → ^3.7.0
  - `@uppy/thumbnail-generator`: ^0.27.4 → ^3.1.0
  - `@uppy/tus`: ^0.27.5 → ^3.5.0

- **Express & Middleware**: 
  - `express`: ~4.16.0 → ^4.18.2
  - `express-session`: ^1.15.6 → ^1.17.3
  - `cookie-parser`: ~1.4.3 → ^1.4.6
  - `morgan`: ~1.9.0 → ^1.10.0

- **Template & View Engines**:
  - `ejs`: ~2.5.7 → ^3.1.9 (includes security fixes)

- **Build Tools**:
  - `parcel`: ^1.10.3 → ^2.12.0 (major version bump - see breaking changes below)

- **Authentication**:
  - `passport`: ^0.4.0 → ^0.7.0
  - `passport-ldapauth`: ^2.1.0 → ^3.0.1

- **UI Libraries**:
  - `bulma`: ^0.7.1 → ^0.9.4
  - `clipboard`: ^2.0.1 → ^2.0.11
  - `sweetalert2`: ^8.10.7 → ^11.10.0

- **Utilities**:
  - `debug`: ~2.6.9 → ^4.3.4
  - `http-errors`: ~1.6.2 → ^2.0.0
  - `md5-file`: ^4.0.0 → ^5.0.0

- **Database**:
  - `session-rethinkdb`: ^2.0.1 (corrected version, but package is deprecated)
  - `tus-node-server`: ^0.3.2 → ^0.9.0 (deprecated - consider migrating to @tus/server)

#### Removed Dependencies
- **`less-middleware`**: Removed (not used in codebase)
- **`node-sass-middleware`**: Removed (deprecated)

#### Added Dependencies
- **`axios`**: ^1.6.0 (replaced deprecated `request` package)
- **`sass`**: ^1.70.0 (modern replacement for node-sass)
- **`sass-middleware`**: ^0.0.3 (replacement for node-sass-middleware)

### 3. Code Changes

#### Migration from `request` to `axios`
**File**: `lib/postUpload.js`

**Before**:
```javascript
const request = require('request');

request.post(
  config.postChangesTo,
  {json: {params: filePath}},
  function (error, response, body) {
    if (error) {
      console.error(error);
    }
    if (!error && response.statusCode == 200) {
      console.log('posted changes to', config.postChangesTo);
    }
  }
);
```

**After**:
```javascript
const axios = require("axios");

axios
  .post(config.postChangesTo, { params: filePath })
  .then((response) => {
    console.log("posted changes to", config.postChangesTo);
  })
  .catch((error) => {
    console.error(error);
  });
```

#### Migration from `node-sass-middleware` to `sass-middleware`
**File**: `app.js`

**Before**:
```javascript
const sassMiddleware = require("node-sass-middleware");
```

**After**:
```javascript
const sassMiddleware = require("sass-middleware");
```

### 4. Build Configuration Changes

#### Parcel v2 Migration

**Created `.parcelrc`**:
```json
{
  "extends": "@parcel/config-default",
  "transformers": {
    "*.js": ["@parcel/transformer-babel"]
  }
}
```

**Updated npm scripts** in `package.json`:

**Before**:
```json
"build": "node_modules/.bin/parcel build public/js/src/*.js -d public/js/dist/",
"watch": "node_modules/.bin/parcel watch public/js/src/*.js -d public/js/dist/"
```

**After**:
```json
"build": "parcel build public/js/src/*.js --dist-dir public/js/dist/",
"watch": "parcel watch public/js/src/*.js --dist-dir public/js/dist/"
```

**Key Changes**:
- Removed `node_modules/.bin/` prefix (npm finds it automatically)
- Changed `-d` flag to `--dist-dir` (Parcel v2 syntax)

## Installation Instructions

### 1. Switch to Node 24
```bash
nvm install 24
nvm use 24
```

### 2. Clean Install Dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

### 3. Verify Installation
```bash
node --version  # Should show v24.x.x
npm --version   # Should show v11.x.x (comes with Node 24)
```

### 4. Test Build
```bash
npm run build
```

### 5. Start Server
```bash
npm start
```

## Potential Breaking Changes & Migration Notes

### 1. Parcel v2
Parcel v2 has significant breaking changes from v1:
- Different configuration system (now uses `.parcelrc`)
- Different CLI flags
- May need to adjust bundling behavior if custom configurations were used

**Documentation**: https://parceljs.org/getting-started/migration/

### 2. Uppy v3
Uppy v3 has API changes from v0.27:
- Constructor and initialization may differ
- Some plugin options have changed
- Check frontend JavaScript for Uppy usage

**Migration Guide**: https://uppy.io/docs/migration-guides/

### 3. EJS v3
EJS v3 has improved security:
- Stricter parsing
- Better XSS protection
- Review templates if you notice rendering issues

### 4. Axios vs Request
The deprecated `request` package was replaced with `axios`:
- Different API (promises instead of callbacks)
- Automatic JSON parsing
- Better error handling
- More actively maintained

### 5. Sass vs Node-Sass
Modern `sass` package (Dart Sass) vs deprecated `node-sass`:
- Full CSS feature support (including modern `calc()`)
- Better performance
- No native compilation issues
- Actively maintained

**Note**: `@import` is deprecated in modern Sass. Consider migrating to `@use` and `@forward` in the future.

## Deprecation Warnings

After running `npm install`, you may see several deprecation warnings:

1. **`tus-node-server`**: Has been split into packages. Consider migrating to `@tus/server`
2. **`session-rethinkdb`**: Package no longer supported. May need to find alternative session store
3. **`ldapjs`**: Package has been decommissioned. Consider alternative LDAP libraries
4. **`querystring`**: Use `URLSearchParams` API instead (handled automatically by newer packages)

These warnings indicate packages that work but are no longer maintained. The application should still function, but consider these migrations for long-term maintenance:

- **Session Store**: Migrate from `session-rethinkdb` to a maintained alternative (e.g., `connect-redis`, `connect-mongo`)
- **TUS Server**: Update from `tus-node-server` to `@tus/server`
- **LDAP**: Consider migrating to a maintained LDAP library if authentication issues arise

## Known Issues & Troubleshooting

### Issue: npm install fails with version errors
**Solution**: Make sure you're using Node 24:
```bash
node --version
nvm use 24
```

### Issue: Parcel build fails
**Solution**: Check that `.parcelrc` exists in project root. Parcel v2 may need additional configuration for specific use cases.

### Issue: SASS compilation errors
**Solution**: Modern Sass has stricter syntax. Check SCSS files for deprecated syntax.

### Issue: Session store not working
**Solution**: Verify RethinkDB is running and accessible. The `session-rethinkdb` package may need configuration updates for newer RethinkDB versions.

## Security Considerations

After installation, you may see vulnerabilities:
```bash
npm audit
```

To fix non-breaking issues:
```bash
npm audit fix
```

**Warning**: Do not run `npm audit fix --force` without testing, as it may introduce breaking changes.

## Testing Checklist

- [ ] Server starts without errors (`npm start`)
- [ ] Build completes successfully (`npm run build`)
- [ ] Watch mode works (`npm run watch`)
- [ ] File uploads work (Uppy integration)
- [ ] LDAP authentication works (note: ldapjs is deprecated)
- [ ] Session persistence works (note: session-rethinkdb is deprecated)
- [ ] SASS/CSS compiles correctly
- [ ] Static assets load properly
- [ ] Database connections work
- [ ] Review and address npm audit vulnerabilities

## Future Improvements (Priority Order)

### High Priority (Deprecated Packages)
1. **Replace `tus-node-server`**: Migrate to `@tus/server` for continued support
2. **Replace `session-rethinkdb`**: Migrate to maintained session store (connect-redis, connect-mongo, etc.)
3. **Replace `ldapjs`**: Find maintained LDAP authentication library
4. **Address Security Vulnerabilities**: Run `npm audit` and fix issues

### Medium Priority
5. **Migrate to ES Modules**: Consider using `import`/`export` instead of `require()`
6. **TypeScript**: Add TypeScript for better type safety
7. **Update Uppy**: Review and update Uppy implementation for v3 best practices
8. **Sass Modules**: Migrate from `@import` to `@use`/`@forward`

### Low Priority
9. **Modern Fetch**: Replace axios with native `fetch()` API (available in Node 18+)
10. **Update Tests**: Add comprehensive test suite with modern testing framework
11. **Environment Variables**: Use dotenv or similar for configuration management

## References

- [Node.js v24 Release Notes](https://nodejs.org/en/blog/release/v24.0.0)
- [Parcel v2 Migration Guide](https://parceljs.org/getting-started/migration/)
- [Uppy Migration Guides](https://uppy.io/docs/migration-guides/)
- [Sass Migration Guide](https://sass-lang.com/documentation/breaking-changes/)
- [Axios Documentation](https://axios-http.com/docs/intro)

## Support

If you encounter issues during migration:
1. Check this guide for common issues
2. Review the official migration guides for each dependency
3. Check GitHub issues for the specific packages
4. Ensure all environment dependencies (RethinkDB, etc.) are compatible

---

**Migration Date**: November 2024  
**Node Version**: 12.22.7 → 24.x.x  
**Status**: ✅ Complete