# Help Page Tests Documentation

## Overview
This document describes the tests for the Help page (`/help`) of the TSL Image Data application.

## Issue Fixed
The help page was not loading due to incorrect EJS include statements. The issue was in `/views/help/index.ejs`:

**Before (Broken):**
```ejs
<%- include ../head.ejs %>
<%- include ../foot.ejs %>
```

**After (Fixed):**
```ejs
<%-include('../head.ejs') %>
<%-include('../foot.ejs') %>
```

## Test Files

### 1. `help.spec.js`
Basic unit tests for the help page that can run without a full authentication setup.

**Tests included:**
- Redirect to signin when not authenticated
- Page structure and content verification
- Link validation (NCBI taxonomy, email)
- Image display verification
- Responsive layout checks
- Console error monitoring

### 2. `help-integration.spec.js`
Integration tests that require actual authentication and a running server.

**Tests included:**
- Full authentication flow
- Navigation from home to help
- Complete content verification
- Responsive design across viewports
- Error handling
- Performance metrics

## Running the Tests

### Prerequisites
1. Ensure all dependencies are installed:
```bash
npm install
```

2. For integration tests, ensure the server is running:
```bash
npm start
```

### Basic Tests (No Authentication Required)
Run the basic help page tests:
```bash
npm run test:help
```

Run with visible browser:
```bash
npm run test:help:headed
```

### Integration Tests (Authentication Required)
For integration tests, you need to provide test credentials:

```bash
# Set environment variables (Unix/Mac)
export TEST_USERNAME="your_username"
export TEST_PASSWORD="your_password"

# Windows
set TEST_USERNAME=your_username
set TEST_PASSWORD=your_password

# Run the integration tests
npm run test:help-integration
```

Run with visible browser:
```bash
npm run test:help-integration:headed
```

### Running All Tests
To run all tests in the project:
```bash
npm run test:all
```

## Test Coverage

The help page tests verify:

1. **Authentication Flow**
   - Proper redirect when not authenticated
   - Access granted after login

2. **Page Content**
   - Main title and headings
   - Four data model levels (Project, Sample, Experiment, Capture)
   - Descriptive text for each level
   - Data model diagram
   - Contact information
   - External links

3. **Page Structure**
   - Proper HTML structure
   - Bulma CSS framework components
   - Responsive design

4. **Error Handling**
   - No console errors
   - Graceful failure modes

5. **Performance**
   - Page load time
   - Image loading

## Troubleshooting

### Tests Skip Due to Authentication
If tests are being skipped with "Requires authentication", this is expected behavior when:
- The server is not running
- No valid test credentials are provided
- The mock authentication cookies are not accepted

**Solution:** Use the integration tests with proper credentials or ensure the server is running with a valid authentication setup.

### Image Not Found
If tests fail due to missing `/img/images_data_model.png`:
1. Ensure the image exists in `/public/img/`
2. Check that the static file serving is configured in the Express app

### EJS Template Errors
If you see template compilation errors:
1. Verify the include syntax uses quotes and parentheses
2. Check that all included files exist
3. Ensure proper path resolution from the view directory

## Continuous Integration

For CI/CD pipelines, you can run tests without headed mode:
```bash
# Run all tests
npm test

# Run specific test suite
npm run test:help
```

For environments where authentication is available:
```bash
TEST_USERNAME=ci_user TEST_PASSWORD=ci_pass npm run test:help-integration
```

## Contributing

When modifying the help page:
1. Ensure all tests pass before committing
2. Add new tests for new features
3. Update this documentation if test structure changes
4. Use meaningful test descriptions

## Related Files
- `/views/help/index.ejs` - The help page template
- `/controllers/help.js` - Help page controller
- `/routes.js` - Route definitions including `/help`
- `/public/img/images_data_model.png` - Data model diagram