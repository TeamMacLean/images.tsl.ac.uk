#!/usr/bin/env node

/**
 * Simple verification script for the mailto link fix in the help page
 * This checks that the help page no longer has the syntax error that was causing
 * the "Unexpected token '.'" error in the popup.
 */

const fs = require('fs');
const path = require('path');

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

function checkHelpPageMailtoFix() {
  log('\n==================================================', 'cyan');
  log('Mailto Link Fix Verification for Help Page', 'cyan');
  log('==================================================', 'cyan');

  const helpPagePath = path.join(__dirname, 'views', 'help', 'index.ejs');

  // Check if file exists
  if (!fs.existsSync(helpPagePath)) {
    log('\n✗ Help page file not found at expected location', 'red');
    log(`  Expected: ${helpPagePath}`, 'yellow');
    return false;
  }

  log('\n✓ Help page file found', 'green');

  // Read the file content
  const content = fs.readFileSync(helpPagePath, 'utf8');

  // Check for the old incorrect format
  const incorrectMailtoRegex = /mailto:bioinformatics\.tsl\.ac\.uk(?!@)/;
  const hasIncorrectFormat = incorrectMailtoRegex.test(content);

  // Check for the correct format
  const correctMailtoRegex = /mailto:bioinformatics@tsl\.ac\.uk/;
  const hasCorrectFormat = correctMailtoRegex.test(content);

  log('\nChecking mailto link format:', 'cyan');
  log('-----------------------------', 'cyan');

  if (hasIncorrectFormat) {
    log('✗ PROBLEM FOUND: Incorrect mailto format detected!', 'red');
    log('  Found: mailto:bioinformatics.tsl.ac.uk (missing @ symbol)', 'yellow');
    log('  This will cause: "Unexpected token \'.\'" error in EJS', 'yellow');
    log('\n  TO FIX:', 'cyan');
    log('  Change: mailto:bioinformatics.tsl.ac.uk', 'red');
    log('  To:     mailto:bioinformatics@tsl.ac.uk', 'green');

    // Find the line number
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (incorrectMailtoRegex.test(line)) {
        log(`\n  Location: Line ${index + 1}`, 'yellow');
        log(`  Current line: ${line.trim()}`, 'yellow');
      }
    });

    return false;
  } else if (hasCorrectFormat) {
    log('✅ FIXED: Mailto link format is correct!', 'green');
    log('  Found: mailto:bioinformatics@tsl.ac.uk', 'green');
    log('  The popup should work without EJS errors', 'green');

    // Show the corrected line
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (correctMailtoRegex.test(line)) {
        log(`\n  Location: Line ${index + 1}`, 'blue');
        log(`  Current line: ${line.trim()}`, 'blue');
      }
    });

    return true;
  } else {
    log('⚠ No mailto link found for bioinformatics email', 'yellow');
    log('  This may be okay if the contact section was removed', 'yellow');
    return true;
  }
}

function checkIncludeStatements() {
  log('\n\nChecking EJS include statements:', 'cyan');
  log('----------------------------------', 'cyan');

  const helpPagePath = path.join(__dirname, 'views', 'help', 'index.ejs');

  if (!fs.existsSync(helpPagePath)) {
    log('✗ Cannot check - file not found', 'red');
    return false;
  }

  const content = fs.readFileSync(helpPagePath, 'utf8');

  // Check for old incorrect include format
  const incorrectIncludeRegex = /<%[-=]?\s*include\s+[^('"]/;
  const hasIncorrectIncludes = incorrectIncludeRegex.test(content);

  // Check for correct include format
  const correctIncludeRegex = /<%-?\s*include\s*\(['"]/;
  const hasCorrectIncludes = correctIncludeRegex.test(content);

  if (hasIncorrectIncludes) {
    log('✗ PROBLEM: Incorrect include statement format detected', 'red');
    log('  Old format: <%- include ../head.ejs %>', 'yellow');
    log('  Should be:  <%-include(\'../head.ejs\') %>', 'green');

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      if (incorrectIncludeRegex.test(line)) {
        log(`\n  Line ${index + 1}: ${line.trim()}`, 'yellow');
      }
    });

    return false;
  } else if (hasCorrectIncludes) {
    log('✅ Include statements are correctly formatted', 'green');

    // Count and show includes
    const includeMatches = content.match(/<%-?\s*include\s*\([^)]+\)/g) || [];
    log(`  Found ${includeMatches.length} include statement(s)`, 'blue');
    includeMatches.forEach((match, index) => {
      log(`    ${index + 1}. ${match}`, 'blue');
    });

    return true;
  } else {
    log('⚠ No include statements found', 'yellow');
    return true;
  }
}

function checkOpenHelpFunction() {
  log('\n\nChecking openHelp() function:', 'cyan');
  log('------------------------------', 'cyan');

  const headPath = path.join(__dirname, 'views', 'head.ejs');

  if (!fs.existsSync(headPath)) {
    log('⚠ head.ejs not found - cannot verify openHelp function', 'yellow');
    return true; // Not a critical error
  }

  const content = fs.readFileSync(headPath, 'utf8');

  // Check for openHelp function definition
  const openHelpRegex = /function\s+openHelp\s*\(\)/;
  const hasOpenHelp = openHelpRegex.test(content);

  if (hasOpenHelp) {
    log('✅ openHelp() function is defined', 'green');

    // Check if it opens /help
    if (content.includes('window.open(\'/help\'')) {
      log('  ✓ Opens /help URL', 'green');
    }

    // Check window parameters
    if (content.includes('height=570') && content.includes('width=520')) {
      log('  ✓ Popup dimensions set (570x520)', 'green');
    }

    return true;
  } else {
    log('⚠ openHelp() function not found in head.ejs', 'yellow');
    log('  The "read more" links may not work', 'yellow');
    return false;
  }
}

function main() {
  log('=================================================', 'cyan');
  log('Help Page Mailto Fix Verification', 'cyan');
  log('=================================================', 'cyan');
  log('\nThis script verifies the fix for the error:', 'yellow');
  log('"SyntaxError: Unexpected token \'.\' in help/index.ejs"', 'red');

  let allChecksPassed = true;

  // Run checks
  const mailtoFixed = checkHelpPageMailtoFix();
  const includesFixed = checkIncludeStatements();
  const openHelpExists = checkOpenHelpFunction();

  allChecksPassed = mailtoFixed && includesFixed && openHelpExists;

  // Summary
  log('\n\n==================================================', 'cyan');
  log('SUMMARY', 'cyan');
  log('==================================================', 'cyan');

  if (mailtoFixed) {
    log('✅ Mailto link:      FIXED', 'green');
  } else {
    log('❌ Mailto link:      NEEDS FIX', 'red');
  }

  if (includesFixed) {
    log('✅ Include statements: OK', 'green');
  } else {
    log('❌ Include statements: NEED FIX', 'red');
  }

  if (openHelpExists) {
    log('✅ OpenHelp function:  OK', 'green');
  } else {
    log('⚠️  OpenHelp function:  MISSING', 'yellow');
  }

  if (allChecksPassed) {
    log('\n🎉 SUCCESS: All fixes have been applied!', 'green');
    log('The help popup should now work without errors.', 'green');
    log('\nTo test:', 'cyan');
    log('1. Start the server: npm start', 'blue');
    log('2. Login and navigate to "New Project" page', 'blue');
    log('3. Click "read more" link', 'blue');
    log('4. Help page should open in popup without errors', 'blue');
  } else {
    log('\n⚠️  ATTENTION: Some issues need to be addressed', 'yellow');
    log('Please apply the fixes mentioned above.', 'yellow');
  }

  log('\n==================================================\n', 'cyan');

  // Exit with appropriate code
  process.exit(allChecksPassed ? 0 : 1);
}

// Run the verification
try {
  main();
} catch (error) {
  log(`\n✗ Unexpected error: ${error.message}`, 'red');
  log(error.stack, 'red');
  process.exit(1);
}
