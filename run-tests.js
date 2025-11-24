#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Available test suites
const testSuites = {
  'frontend': 'tests/frontpage.spec.js',
  'uppy': 'tests/uppy.spec.js',
  'thinky': 'tests/thinky.spec.js',
  'uploader': 'tests/uploader-module.spec.js',
  'all': 'tests/*.spec.js'
};

// Parse command line arguments
const args = process.argv.slice(2);
const suite = args[0] || 'all';
const additionalArgs = args.slice(1);

// Show help if requested
if (suite === '--help' || suite === '-h') {
  console.log(`${colors.bright}${colors.cyan}Test Runner for Uppy and Thinky${colors.reset}\n`);
  console.log('Usage: node run-tests.js [suite] [options]\n');
  console.log('Available test suites:');
  console.log(`  ${colors.yellow}frontend${colors.reset}  - Run frontend/UI tests`);
  console.log(`  ${colors.yellow}uppy${colors.reset}      - Run Uppy v5 functionality tests`);
  console.log(`  ${colors.yellow}thinky${colors.reset}    - Run Thinky v1.15.1 ORM tests`);
  console.log(`  ${colors.yellow}uploader${colors.reset}  - Run uploader module integration tests`);
  console.log(`  ${colors.yellow}all${colors.reset}       - Run all tests (default)\n`);
  console.log('Additional options:');
  console.log(`  ${colors.yellow}--headed${colors.reset}  - Run tests in headed mode (visible browser)`);
  console.log(`  ${colors.yellow}--ui${colors.reset}      - Open Playwright test UI`);
  console.log(`  ${colors.yellow}--report${colors.reset}  - Show HTML report after tests`);
  console.log(`  ${colors.yellow}--debug${colors.reset}   - Run tests with debug output\n`);
  console.log('Examples:');
  console.log(`  ${colors.green}node run-tests.js${colors.reset}              # Run all tests`);
  console.log(`  ${colors.green}node run-tests.js uppy${colors.reset}         # Run only Uppy tests`);
  console.log(`  ${colors.green}node run-tests.js thinky --headed${colors.reset}  # Run Thinky tests with visible browser`);
  console.log(`  ${colors.green}node run-tests.js all --ui${colors.reset}     # Open test UI with all tests`);
  process.exit(0);
}

// Validate suite selection
if (!testSuites[suite]) {
  console.error(`${colors.red}Error: Unknown test suite '${suite}'${colors.reset}`);
  console.log(`Available suites: ${Object.keys(testSuites).join(', ')}`);
  console.log(`Run 'node run-tests.js --help' for more information`);
  process.exit(1);
}

// Build playwright command
let playwrightCommand = 'npx';
let playwrightArgs = ['playwright', 'test'];

// Add test file pattern
playwrightArgs.push(testSuites[suite]);

// Handle additional arguments
if (additionalArgs.includes('--headed')) {
  playwrightArgs.push('--headed');
}

if (additionalArgs.includes('--ui')) {
  playwrightArgs = ['playwright', 'test', '--ui'];
  if (suite !== 'all') {
    playwrightArgs.push(testSuites[suite]);
  }
}

if (additionalArgs.includes('--debug')) {
  playwrightArgs.push('--debug');
}

// Add report generation unless --ui is used
if (!additionalArgs.includes('--ui')) {
  playwrightArgs.push('--reporter=html');
}

// Print test execution header
console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}  Running Test Suite: ${colors.yellow}${suite.toUpperCase()}${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════${colors.reset}\n`);

if (suite === 'all') {
  console.log(`${colors.blue}Running all test suites:${colors.reset}`);
  Object.entries(testSuites).forEach(([name, path]) => {
    if (name !== 'all') {
      console.log(`  • ${name}: ${colors.green}${path}${colors.reset}`);
    }
  });
  console.log();
} else {
  console.log(`${colors.blue}Test file: ${colors.green}${testSuites[suite]}${colors.reset}\n`);
}

// Run the tests
const testProcess = spawn(playwrightCommand, playwrightArgs, {
  stdio: 'inherit',
  shell: true
});

// Handle test completion
testProcess.on('close', (code) => {
  console.log(`\n${colors.bright}${colors.cyan}════════════════════════════════════════════════════════${colors.reset}`);

  if (code === 0) {
    console.log(`${colors.bright}${colors.green}✓ Tests completed successfully!${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}✗ Tests failed with exit code: ${code}${colors.reset}`);
  }

  console.log(`${colors.bright}${colors.cyan}════════════════════════════════════════════════════════${colors.reset}\n`);

  // Show report command if tests were run (not UI mode)
  if (!additionalArgs.includes('--ui') && additionalArgs.includes('--report')) {
    console.log(`${colors.yellow}Opening HTML report...${colors.reset}`);
    const reportProcess = spawn('npx', ['playwright', 'show-report'], {
      stdio: 'inherit',
      shell: true
    });

    reportProcess.on('error', (err) => {
      console.error(`${colors.red}Failed to open report: ${err.message}${colors.reset}`);
    });
  } else if (!additionalArgs.includes('--ui')) {
    console.log(`${colors.cyan}To view the HTML report, run:${colors.reset}`);
    console.log(`  ${colors.green}npm run test:report${colors.reset}`);
    console.log(`  ${colors.cyan}or${colors.reset}`);
    console.log(`  ${colors.green}npx playwright show-report${colors.reset}\n`);
  }

  process.exit(code);
});

// Handle errors
testProcess.on('error', (err) => {
  console.error(`${colors.red}Failed to start test process: ${err.message}${colors.reset}`);
  process.exit(1);
});

// Handle interrupts
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}Test execution interrupted${colors.reset}`);
  testProcess.kill('SIGINT');
});
