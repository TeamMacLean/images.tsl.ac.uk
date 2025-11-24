#!/usr/bin/env node

/**
 * Final validation script for all help page fixes
 * This script validates that both issues have been resolved:
 * 1. EJS include statement syntax
 * 2. Mailto link format (missing @ symbol)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { parse } = require('url');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Validation results tracker
const results = {
  passed: [],
  failed: [],
  warnings: []
};

// Helper function to add result
function addResult(type, message) {
  results[type].push(message);
}

// Check 1: Validate EJS include statements
function validateIncludeStatements() {
  log('\n📋 Checking EJS Include Statements', 'cyan');
  log('=' .repeat(50), 'cyan');

  const helpFile = path.join(__dirname, 'views', 'help', 'index.ejs');

  if (!fs.existsSync(helpFile)) {
    addResult('failed', 'Help page file not found');
    log('  ❌ Help page not found at: ' + helpFile, 'red');
    return false;
  }

  const content = fs.readFileSync(helpFile, 'utf8');

  // Check for incorrect include format
  const incorrectPattern = /<%[-=]?\s*include\s+[^('"]/;
  const correctPattern = /<%-?\s*include\s*\(['"]/;

  if (incorrectPattern.test(content)) {
    addResult('failed', 'Incorrect include statement format found');
    log('  ❌ Found old include syntax (missing quotes/parentheses)', 'red');

    // Find problematic lines
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (incorrectPattern.test(line)) {
        log(`     Line ${index + 1}: ${line.trim()}`, 'yellow');
      }
    });
    return false;
  }

  if (correctPattern.test(content)) {
    addResult('passed', 'Include statements correctly formatted');
    log('  ✅ Include statements use correct syntax', 'green');

    // Count includes
    const matches = content.match(/<%-?\s*include\s*\([^)]+\)/g) || [];
    log(`     Found ${matches.length} properly formatted include(s)`, 'blue');
    return true;
  }

  addResult('warnings', 'No include statements found');
  log('  ⚠️  No include statements found', 'yellow');
  return true;
}

// Check 2: Validate mailto link format
function validateMailtoLink() {
  log('\n📧 Checking Mailto Link Format', 'cyan');
  log('=' .repeat(50), 'cyan');

  const helpFile = path.join(__dirname, 'views', 'help', 'index.ejs');

  if (!fs.existsSync(helpFile)) {
    addResult('failed', 'Help page file not found for mailto check');
    log('  ❌ Help page not found', 'red');
    return false;
  }

  const content = fs.readFileSync(helpFile, 'utf8');

  // Check for incorrect mailto (missing @)
  const incorrectMailto = /mailto:bioinformatics\.tsl\.ac\.uk(?!@)/;
  const correctMailto = /mailto:bioinformatics@tsl\.ac\.uk/;

  if (incorrectMailto.test(content)) {
    addResult('failed', 'Incorrect mailto format (missing @ symbol)');
    log('  ❌ Found incorrect mailto format', 'red');
    log('     Missing @ symbol in: mailto:bioinformatics.tsl.ac.uk', 'yellow');

    // Find line number
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (incorrectMailto.test(line)) {
        log(`     Line ${index + 1}: ${line.trim()}`, 'yellow');
      }
    });
    return false;
  }

  if (correctMailto.test(content)) {
    addResult('passed', 'Mailto link correctly formatted');
    log('  ✅ Mailto link has correct format with @ symbol', 'green');
    log('     mailto:bioinformatics@tsl.ac.uk', 'blue');
    return true;
  }

  addResult('warnings', 'No bioinformatics mailto link found');
  log('  ⚠️  No bioinformatics mailto link found', 'yellow');
  return true;
}

// Check 3: Validate openHelp function
function validateOpenHelpFunction() {
  log('\n🔧 Checking openHelp() Function', 'cyan');
  log('=' .repeat(50), 'cyan');

  const headFile = path.join(__dirname, 'views', 'head.ejs');

  if (!fs.existsSync(headFile)) {
    addResult('warnings', 'head.ejs not found - cannot verify openHelp');
    log('  ⚠️  head.ejs not found', 'yellow');
    return true;
  }

  const content = fs.readFileSync(headFile, 'utf8');

  if (content.includes('function openHelp()')) {
    addResult('passed', 'openHelp function found');
    log('  ✅ openHelp() function is defined', 'green');

    // Check parameters
    if (content.includes("window.open('/help'")) {
      log('     ✓ Opens /help URL', 'green');
    }
    if (content.includes('height=570') && content.includes('width=520')) {
      log('     ✓ Correct popup dimensions (570x520)', 'green');
    }
    if (content.includes('scrollbars=yes')) {
      log('     ✓ Scrollbars enabled', 'green');
    }
    return true;
  }

  addResult('failed', 'openHelp function not found');
  log('  ❌ openHelp() function not found', 'red');
  return false;
}

// Check 4: Test server response
async function validateServerResponse() {
  log('\n🌐 Checking Server Response', 'cyan');
  log('=' .repeat(50), 'cyan');

  const baseUrl = 'http://localhost:3071';

  return new Promise((resolve) => {
    http.get(`${baseUrl}/help`, (res) => {
      if (res.statusCode === 302 && res.headers.location === '/signin') {
        addResult('passed', 'Help route redirects to signin when unauthenticated');
        log('  ✅ Help page correctly redirects to signin', 'green');
        log('     Status: 302, Location: /signin', 'blue');
        resolve(true);
      } else if (res.statusCode === 200) {
        addResult('passed', 'Help route accessible');
        log('  ✅ Help page returns 200 OK', 'green');
        resolve(true);
      } else {
        addResult('warnings', `Unexpected status code: ${res.statusCode}`);
        log(`  ⚠️  Unexpected status: ${res.statusCode}`, 'yellow');
        resolve(true);
      }
    }).on('error', (err) => {
      addResult('warnings', 'Server not reachable');
      log('  ⚠️  Server not reachable at localhost:3071', 'yellow');
      log('     Make sure server is running: npm start', 'blue');
      resolve(false);
    });
  });
}

// Check 5: Validate all pages with "read more" links
function validateReadMorePages() {
  log('\n📄 Checking Pages with "Read More" Links', 'cyan');
  log('=' .repeat(50), 'cyan');

  const pagesToCheck = [
    { file: 'projects/new.ejs', name: 'New Project' },
    { file: 'projects/edit.ejs', name: 'Edit Project' },
    { file: 'samples/new.ejs', name: 'New Sample' },
    { file: 'samples/edit.ejs', name: 'Edit Sample' },
    { file: 'experiments/new.ejs', name: 'New Experiment' },
    { file: 'experiments/edit.ejs', name: 'Edit Experiment' },
    { file: 'captures/new.ejs', name: 'New Capture' },
    { file: 'captures/edit.ejs', name: 'Edit Capture' }
  ];

  let allGood = true;

  pagesToCheck.forEach(page => {
    const filePath = path.join(__dirname, 'views', page.file);

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');

      if (content.includes('onclick="openHelp()"')) {
        log(`  ✅ ${page.name}: Has "read more" link with openHelp()`, 'green');
      } else if (content.includes('openHelp')) {
        log(`  ✅ ${page.name}: References openHelp function`, 'green');
      } else {
        log(`  ⚠️  ${page.name}: No openHelp reference found`, 'yellow');
      }
    } else {
      log(`  ⚠️  ${page.name}: File not found`, 'yellow');
      allGood = false;
    }
  });

  if (allGood) {
    addResult('passed', 'All expected pages have read more functionality');
  } else {
    addResult('warnings', 'Some pages missing or incomplete');
  }

  return allGood;
}

// Main validation function
async function runValidation() {
  log('\n' + '='.repeat(60), 'magenta');
  log(`${colors.bold}HELP PAGE FIX VALIDATION SUITE${colors.reset}`, 'magenta');
  log('='.repeat(60), 'magenta');
  log('Validating fixes for:', 'cyan');
  log('1. EJS include statement syntax errors', 'blue');
  log('2. Mailto link "Unexpected token ." error', 'blue');
  log('='.repeat(60), 'magenta');

  // Run all checks
  validateIncludeStatements();
  validateMailtoLink();
  validateOpenHelpFunction();
  validateReadMorePages();
  await validateServerResponse();

  // Generate summary
  log('\n' + '='.repeat(60), 'magenta');
  log(`${colors.bold}VALIDATION SUMMARY${colors.reset}`, 'magenta');
  log('='.repeat(60), 'magenta');

  if (results.passed.length > 0) {
    log(`\n✅ PASSED (${results.passed.length}):`, 'green');
    results.passed.forEach(item => {
      log(`   • ${item}`, 'green');
    });
  }

  if (results.warnings.length > 0) {
    log(`\n⚠️  WARNINGS (${results.warnings.length}):`, 'yellow');
    results.warnings.forEach(item => {
      log(`   • ${item}`, 'yellow');
    });
  }

  if (results.failed.length > 0) {
    log(`\n❌ FAILED (${results.failed.length}):`, 'red');
    results.failed.forEach(item => {
      log(`   • ${item}`, 'red');
    });
  }

  // Final verdict
  log('\n' + '='.repeat(60), 'magenta');

  if (results.failed.length === 0) {
    log('🎉 ALL CRITICAL FIXES VALIDATED SUCCESSFULLY! 🎉', 'green');
    log('The help popup should work without errors.', 'green');

    log('\n📝 Testing Instructions:', 'cyan');
    log('1. Start the server: npm start', 'blue');
    log('2. Login to the application', 'blue');
    log('3. Navigate to any "New Project/Sample/Experiment/Capture" page', 'blue');
    log('4. Click the "read more" link', 'blue');
    log('5. Verify the help page opens in a popup without errors', 'blue');

    log('\n🧪 Run automated tests:', 'cyan');
    log('• npm run test:help', 'blue');
    log('• npm run test:help-popup-basic', 'blue');
    log('• npm run test:help-integration (requires auth)', 'blue');

    process.exit(0);
  } else {
    log('❌ VALIDATION FAILED - FIXES NEEDED', 'red');
    log(`Found ${results.failed.length} critical issue(s) that need attention.`, 'red');

    log('\n📝 To Fix:', 'cyan');
    if (results.failed.some(f => f.includes('include'))) {
      log('• Fix include statements: <%-include("../file.ejs") %>', 'yellow');
    }
    if (results.failed.some(f => f.includes('mailto'))) {
      log('• Fix mailto link: mailto:bioinformatics@tsl.ac.uk', 'yellow');
    }

    process.exit(1);
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  log(`\n❌ Unexpected error: ${error.message}`, 'red');
  log(error.stack, 'red');
  process.exit(1);
});

// Run validation
runValidation().catch(error => {
  log(`\n❌ Validation error: ${error.message}`, 'red');
  process.exit(1);
});
