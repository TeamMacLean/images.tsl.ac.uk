# Help Page Tests Documentation

## Overview
This document describes the tests for the Help page (`/help`) of the TSL Image Data application.

## Issues Fixed

### Issue 1: Include Statement Syntax
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

### Issue 2: Mailto Link Syntax Error
The help popup showed "SyntaxError: Unexpected token '.'" when clicking "read more" from project pages. The issue was an incorrect mailto link format:

**Before (Broken):**
```html
<a href="mailto:bioinformatics.tsl.ac.uk">bioinformatics@tsl.ac.uk</a>
```

**After (Fixed):**
```html
<a href="mailto:bioinformatics@tsl.ac.uk">bioinformatics@tsl.ac.uk</a>
```

The mailto link was missing the @ symbol in the href attribute, causing EJS parsing errors when the help page was loaded in a popup.

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

### 3. `help-popup.spec.js`
Tests for the help popup functionality triggered from "read more" links.

**Tests included:**
- openHelp() function availability
- Popup window opening from project pages
- Content rendering in popup dimensions
- Mailto link correctness
- JavaScript error monitoring
- Popup window parameters verification

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

### Popup Tests
Run the help popup tests:
```bash
npm run test:help-popup
```

Run with visible browser:
```bash
npm run test:help-popup:headed
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

6. **Popup Functionality**
   - openHelp() JavaScript function
   - Popup window parameters
   - Content rendering in popup
   - No JavaScript errors when opening

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
1. Verify the include syntax uses quotes and parentheses: `<%-include('../file.ejs') %>`
2. Check that all included files exist
3. Ensure proper path resolution from the view directory
4. Verify mailto links have @ symbol: `mailto:email@domain.com`
5. Check for any dots in unexpected places that could cause "Unexpected token '.'" errors

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
- `/verify-mailto-fix.js` - Script to verify the mailto link fix
- `/verify-help-page.js` - Script for manual help page verification
- `/test-help-ejs.js` - EJS template validation script