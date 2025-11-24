#!/usr/bin/env node

/**
 * Quick verification script for the help page
 * Usage: node verify-help-page.js [--with-auth username password]
 */

const http = require('http');
const https = require('https');
const { parse } = require('url');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3071';
const HELP_PATH = '/help';

// Parse command line arguments
const args = process.argv.slice(2);
const withAuth = args.includes('--with-auth');
const username = withAuth ? args[args.indexOf('--with-auth') + 1] : null;
const password = withAuth ? args[args.indexOf('--with-auth') + 2] : null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = parse(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: options.method || 'GET',
      headers: options.headers || {},
      ...options
    };

    const req = protocol.request(requestOptions, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function checkHelpPageWithoutAuth() {
  log('\n=== Checking Help Page Without Authentication ===', 'cyan');

  try {
    const response = await makeRequest(`${BASE_URL}${HELP_PATH}`, {
      headers: {
        'User-Agent': 'Help-Page-Verifier/1.0'
      }
    });

    if (response.statusCode === 302 || response.statusCode === 301) {
      const redirectLocation = response.headers.location;
      if (redirectLocation && redirectLocation.includes('/signin')) {
        log('✓ Help page correctly redirects to signin when not authenticated', 'green');
        log(`  Redirect: ${HELP_PATH} → ${redirectLocation}`, 'blue');
        return true;
      } else {
        log('✗ Help page redirects but not to signin page', 'red');
        log(`  Unexpected redirect: ${redirectLocation}`, 'yellow');
        return false;
      }
    } else if (response.statusCode === 200) {
      log('⚠ Help page returned 200 without authentication (might be a configuration issue)', 'yellow');

      // Check if it's actually the help page
      if (response.body.includes('Help') && response.body.includes('Naming stuff')) {
        log('  The help page content is being served without authentication', 'yellow');
      }
      return false;
    } else {
      log(`✗ Unexpected status code: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Error checking help page: ${error.message}`, 'red');
    return false;
  }
}

async function performLogin(username, password) {
  log('\n=== Attempting Login ===', 'cyan');

  try {
    const loginData = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;

    const response = await makeRequest(`${BASE_URL}/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginData),
        'User-Agent': 'Help-Page-Verifier/1.0'
      },
      body: loginData
    });

    if (response.statusCode === 302) {
      const cookies = response.headers['set-cookie'];
      if (cookies) {
        log('✓ Login appears successful (received session cookie)', 'green');
        return cookies;
      }
    }

    log(`⚠ Login returned status ${response.statusCode}`, 'yellow');
    return null;
  } catch (error) {
    log(`✗ Error during login: ${error.message}`, 'red');
    return null;
  }
}

async function checkHelpPageWithAuth(sessionCookies) {
  log('\n=== Checking Help Page With Authentication ===', 'cyan');

  try {
    const cookieHeader = sessionCookies.map(c => c.split(';')[0]).join('; ');

    const response = await makeRequest(`${BASE_URL}${HELP_PATH}`, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Help-Page-Verifier/1.0'
      }
    });

    if (response.statusCode === 200) {
      const body = response.body;

      // Check for key content elements
      const checks = [
        { name: 'Help title', pattern: /<h1[^>]*>.*?Help.*?<\/h1>/i },
        { name: 'Naming section', pattern: /Naming stuff in this image database/i },
        { name: 'Project level', pattern: /<li>.*?Project.*?<\/li>/i },
        { name: 'Sample level', pattern: /<li>.*?Sample.*?<\/li>/i },
        { name: 'Experiment level', pattern: /<li>.*?Experiment.*?<\/li>/i },
        { name: 'Capture level', pattern: /<li>.*?Capture.*?<\/li>/i },
        { name: 'Data model image', pattern: /images_data_model\.png/i },
        { name: 'Contact email', pattern: /bioinformatics@tsl\.ac\.uk/i },
        { name: 'NCBI link', pattern: /ncbi\.nlm\.nih\.gov\/taxonomy/i }
      ];

      log('✓ Help page loaded successfully (200 OK)', 'green');
      log('\nContent verification:', 'cyan');

      let allChecksPassed = true;
      for (const check of checks) {
        if (check.pattern.test(body)) {
          log(`  ✓ ${check.name} found`, 'green');
        } else {
          log(`  ✗ ${check.name} not found`, 'red');
          allChecksPassed = false;
        }
      }

      return allChecksPassed;
    } else if (response.statusCode === 302) {
      log(`⚠ Help page still redirecting even with authentication (status: ${response.statusCode})`, 'yellow');
      log(`  Redirect to: ${response.headers.location}`, 'yellow');
      return false;
    } else {
      log(`✗ Unexpected status code: ${response.statusCode}`, 'red');
      return false;
    }
  } catch (error) {
    log(`✗ Error checking authenticated help page: ${error.message}`, 'red');
    return false;
  }
}

async function main() {
  log('Help Page Verification Script', 'cyan');
  log('=============================', 'cyan');
  log(`Target: ${BASE_URL}${HELP_PATH}`, 'blue');

  // Always check without auth first
  const unauthCheck = await checkHelpPageWithoutAuth();

  // Check with auth if credentials provided
  if (withAuth && username && password) {
    const sessionCookies = await performLogin(username, password);

    if (sessionCookies) {
      const authCheck = await checkHelpPageWithAuth(sessionCookies);

      if (authCheck) {
        log('\n✅ All help page checks passed!', 'green');
      } else {
        log('\n⚠️ Some help page checks failed', 'yellow');
      }
    } else {
      log('\n⚠️ Could not authenticate to check help page content', 'yellow');
    }
  } else {
    if (unauthCheck) {
      log('\n✅ Basic help page check passed (redirects to signin as expected)', 'green');
    } else {
      log('\n❌ Basic help page check failed', 'red');
    }

    if (!withAuth) {
      log('\nTip: Run with authentication to verify help page content:', 'blue');
      log('  node verify-help-page.js --with-auth <username> <password>', 'blue');
    }
  }

  // Check server connectivity
  log('\n=== Server Status ===', 'cyan');
  try {
    const response = await makeRequest(BASE_URL);
    log(`✓ Server is reachable at ${BASE_URL}`, 'green');
  } catch (error) {
    log(`✗ Cannot reach server at ${BASE_URL}`, 'red');
    log(`  Error: ${error.message}`, 'yellow');
    log('\nMake sure the server is running:', 'blue');
    log('  npm start', 'blue');
  }
}

// Run the verification
main().catch(error => {
  log(`\n✗ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
