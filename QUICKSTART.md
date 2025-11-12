# Quick Start Guide - Node 24 Migration

## ✅ Migration Complete!

Your project has been successfully upgraded from Node 12 to Node 24.

## Get Started

### 1. Switch to Node 24
```bash
nvm use 24
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Build Assets
```bash
npm run build
```

### 4. Create Required Directories (Optional)
The app will create directories automatically, but you can pre-create the base directory:
```bash
mkdir -p ./tmp-dev/mnt/images
```

### 5. Prerequisites
Before starting the server, ensure:
- **RethinkDB is running** on `localhost:28015` (or configure your connection)
- Required directories exist (the app will try to create them)

### 6. Start Server
```bash
npm start
```

**Expected startup messages:**
- ✅ `Server listening on port 3071` (or your configured port)
- ✅ `✓ Created directory: ./tmp-dev/mnt/images/[groupname]` (for each group)
- ✅ `✓ Group directory ready: [path]` (confirmation message)
- ⚠️ Database warnings about RethinkDB tables are expected if DB isn't set up yet

## What Changed?

### Major Updates
- ✅ Node 12 → Node 24
- ✅ Parcel 1 → Parcel 2 (build tool)
- ✅ Uppy 0.27 → Uppy 3.x (file uploads)
- ✅ Express 4.16 → Express 4.18
- ✅ EJS 2.5 → EJS 3.1 (security fixes)
- ✅ `request` → `axios` (deprecated package replaced)
- ✅ `node-sass` → `sass` (deprecated package replaced)

### Files Modified
- `.nvmrc` - Updated to Node 24
- `package.json` - All dependencies updated
- `lib/postUpload.js` - Migrated from request to axios
- `app.js` - Updated to use sass-middleware + fixed tus-node-server initialization
- `.parcelrc` - Added for Parcel v2

### New Files Created
- `UPGRADE_TO_NODE24.md` - Detailed migration guide
- `QUICKSTART.md` - This file

## Important Warnings

Some packages are deprecated but still working:

⚠️ **tus-node-server** - Consider migrating to `@tus/server`  
⚠️ **session-rethinkdb** - Package no longer maintained  
⚠️ **ldapjs** - Package has been decommissioned  

The app will work, but plan to replace these in the future.

## Runtime Requirements

### RethinkDB
The application requires RethinkDB for session storage and data persistence.

**Install RethinkDB:**
- macOS: `brew install rethinkdb`
- Or use Docker: `docker run -d -p 28015:28015 -p 8080:8080 rethinkdb`

**Start RethinkDB:**
```bash
rethinkdb
```

The server expects RethinkDB at `localhost:28015` (default).

### File Storage
The application stores uploaded files in `./files` directory (created automatically).

## Security

Check for vulnerabilities:
```bash
npm audit
```

Fix non-breaking issues:
```bash
npm audit fix
```

## Need Help?

Read the detailed migration guide:
```bash
cat UPGRADE_TO_NODE24.md
```

## NPM Scripts

```bash
npm start        # Start the server
npm run build    # Build assets for production
npm run watch    # Watch and rebuild assets during development
```

## Troubleshooting

### Server fails with "options must be defined"
✅ **Fixed!** The tus-node-server initialization has been updated.

### Server fails with RethinkDB errors
Make sure RethinkDB is running:
```bash
rethinkdb
```
Or check your database configuration in the config file.

### Build fails
```bash
rm -rf .parcel-cache node_modules
npm install
npm run build
```

### Wrong Node version
```bash
node --version   # Should show v24.x.x
nvm use 24
```

### Port already in use
Check your config file and ensure the port is available, or kill the process using it.

### Directory creation errors
✅ **Fixed!** The app now creates directories recursively with helpful messages:
- `✓ Created directory: [path]` - Directory created successfully
- `✓ Group directory ready: [path]` - Directory exists and ready
- `✗ Failed to create group directory: [path]` - Permission or other error

If you see failures, check:
- File system permissions
- Disk space
- Parent directory write access

## Next Steps

1. Test all functionality thoroughly
2. Review `npm audit` vulnerabilities
3. Plan migration for deprecated packages (see UPGRADE_TO_NODE24.md)
4. Update documentation with any API changes

---

**Status**: ✅ Ready to use  
**Node Version**: 24.x.x  
**Migration Date**: November 2024