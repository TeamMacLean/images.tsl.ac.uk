#!/usr/bin/env node

/**
 * Test script to validate the help page EJS template renders without errors
 * This specifically checks for EJS compilation issues like the "Unexpected token '.'" error
 */

const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

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

function validateEJSTemplate(filePath, templateName) {
  log(`\nValidating ${templateName}...`, 'cyan');

  try {
    // Read the template file
    const templateContent = fs.readFileSync(filePath, 'utf8');

    // Check for common EJS syntax issues
    const checks = [
      {
        name: 'Include statements',
        pattern: /<%[-=]?\s*include\s+[^('"]/,
        issue: 'Include statement missing quotes or parentheses',
        fix: 'Should be: <%-include("filename") %> or <%-include(\'filename\') %>'
      },
      {
        name: 'Mailto links',
        pattern: /mailto:([^@\s"]+\.[^@\s"]+)(?!@)/,
        issue: 'Mailto link missing @ symbol',
        fix: 'Should be: mailto:email@domain.com'
      },
      {
        name: 'Unclosed EJS tags',
        pattern: /<%[^%]*$/m,
        issue: 'Unclosed EJS tag',
        fix: 'Make sure all <% tags have closing %>'
      },
      {
        name: 'Invalid EJS expressions',
        pattern: /<%=\s*\.\s*\w+/,
        issue: 'Invalid expression starting with dot',
        fix: 'Expression should not start with a dot'
      }
    ];

    let hasIssues = false;

    // Run syntax checks
    checks.forEach(check => {
      if (check.pattern.test(templateContent)) {
        log(`  ✗ ${check.name}: ${check.issue}`, 'red');
        log(`    Fix: ${check.fix}`, 'yellow');
        hasIssues = true;

        // Find and display the problematic lines
        const lines = templateContent.split('\n');
        lines.forEach((line, index) => {
          if (check.pattern.test(line)) {
            log(`    Line ${index + 1}: ${line.trim()}`, 'yellow');
          }
        });
      } else {
        log(`  ✓ ${check.name}: OK`, 'green');
      }
    });

    // Try to compile the template
    log('\n  Testing EJS compilation...', 'cyan');

    try {
      // Mock data that might be used in the template
      const mockData = {
        group: { name: 'Test Group', safeName: 'test-group' },
        project: { name: 'Test Project', safeName: 'test-project' },
        sample: { name: 'Test Sample', safeName: 'test-sample' },
        experiment: { name: 'Test Experiment', safeName: 'test-experiment' },
        capture: { name: 'Test Capture', safeName: 'test-capture' },
        user: { username: 'testuser' },
        breadcrumbs: []
      };

      // Set up options to handle includes
      const options = {
        filename: filePath,
        root: path.dirname(filePath),
        views: [path.dirname(filePath), path.join(path.dirname(filePath), '..')],
        // Mock include function to handle relative paths
        include: function(includePath, data) {
          // Simple mock - in real scenario, this would load the actual file
          return '<!-- included: ' + includePath + ' -->';
        }
      };

      // Compile the template
      const compiled = ejs.compile(templateContent, options);

      // Try to render with mock data
      const rendered = compiled(mockData);

      log(`  ✓ EJS compilation successful`, 'green');
      log(`  ✓ Template renders without errors (${rendered.length} characters)`, 'green');

    } catch (compileError) {
      log(`  ✗ EJS compilation failed: ${compileError.message}`, 'red');

      // Try to extract more details about the error
      if (compileError.message.includes('Unexpected token')) {
        log(`    This is likely a syntax error in the EJS template`, 'yellow');

        // Try to find the line number
        const match = compileError.message.match(/line (\d+)/i);
        if (match) {
          const lineNumber = parseInt(match[1]);
          const lines = templateContent.split('\n');
          if (lines[lineNumber - 1]) {
            log(`    Line ${lineNumber}: ${lines[lineNumber - 1].trim()}`, 'yellow');
          }
        }
      }

      hasIssues = true;
    }

    // Check specific content that should be present
    log('\n  Checking required content...', 'cyan');

    const requiredContent = [
      { pattern: /Help/i, description: 'Help title' },
      { pattern: /Project/i, description: 'Project section' },
      { pattern: /Sample/i, description: 'Sample section' },
      { pattern: /Experiment/i, description: 'Experiment section' },
      { pattern: /Capture/i, description: 'Capture section' },
      { pattern: /bioinformatics@tsl\.ac\.uk/, description: 'Contact email' }
    ];

    requiredContent.forEach(item => {
      if (item.pattern.test(templateContent)) {
        log(`  ✓ Contains ${item.description}`, 'green');
      } else {
        log(`  ⚠ Missing ${item.description}`, 'yellow');
      }
    });

    return !hasIssues;

  } catch (error) {
    log(`  ✗ Error reading file: ${error.message}`, 'red');
    return false;
  }
}

function validateAllHelpRelatedTemplates() {
  log('EJS Template Validation for Help System', 'cyan');
  log('========================================', 'cyan');

  const viewsDir = path.join(__dirname, 'views');
  const templates = [
    { path: path.join(viewsDir, 'help', 'index.ejs'), name: 'Help Page (help/index.ejs)' },
    { path: path.join(viewsDir, 'projects', 'new.ejs'), name: 'New Project Page' },
    { path: path.join(viewsDir, 'projects', 'edit.ejs'), name: 'Edit Project Page' },
    { path: path.join(viewsDir, 'samples', 'new.ejs'), name: 'New Sample Page' },
    { path: path.join(viewsDir, 'samples', 'edit.ejs'), name: 'Edit Sample Page' },
    { path: path.join(viewsDir, 'experiments', 'new.ejs'), name: 'New Experiment Page' },
    { path: path.join(viewsDir, 'experiments', 'edit.ejs'), name: 'Edit Experiment Page' },
    { path: path.join(viewsDir, 'captures', 'new.ejs'), name: 'New Capture Page' },
    { path: path.join(viewsDir, 'captures', 'edit.ejs'), name: 'Edit Capture Page' }
  ];

  let allValid = true;
  const results = [];

  templates.forEach(template => {
    if (fs.existsSync(template.path)) {
      const isValid = validateEJSTemplate(template.path, template.name);
      results.push({ name: template.name, valid: isValid });
      if (!isValid) allValid = false;
    } else {
      log(`\n⚠ Template not found: ${template.name}`, 'yellow');
      log(`  Expected at: ${template.path}`, 'yellow');
      results.push({ name: template.name, valid: false, missing: true });
      allValid = false;
    }
  });

  // Summary
  log('\n========================================', 'cyan');
  log('Summary:', 'cyan');

  results.forEach(result => {
    if (result.missing) {
      log(`  ⚠ ${result.name}: Not found`, 'yellow');
    } else if (result.valid) {
      log(`  ✓ ${result.name}: Valid`, 'green');
    } else {
      log(`  ✗ ${result.name}: Has issues`, 'red');
    }
  });

  if (allValid) {
    log('\n✅ All templates validated successfully!', 'green');
    log('The help system should work without EJS compilation errors.', 'green');
  } else {
    log('\n❌ Some templates have issues that need to be fixed.', 'red');
    log('Fix the issues above to ensure the help popup works correctly.', 'yellow');
  }

  return allValid;
}

// Special check for the specific error mentioned
function checkForSpecificError() {
  log('\nChecking for the specific "Unexpected token \'.\'" error...', 'cyan');

  const helpFile = path.join(__dirname, 'views', 'help', 'index.ejs');

  if (fs.existsSync(helpFile)) {
    const content = fs.readFileSync(helpFile, 'utf8');

    // Check for the old incorrect mailto format
    if (/mailto:bioinformatics\.tsl\.ac\.uk/.test(content)) {
      log('  ✗ Found incorrect mailto link format!', 'red');
      log('    Current: mailto:bioinformatics.tsl.ac.uk', 'yellow');
      log('    Should be: mailto:bioinformatics@tsl.ac.uk', 'green');
      return false;
    }

    // Check for correct mailto format
    if (/mailto:bioinformatics@tsl\.ac\.uk/.test(content)) {
      log('  ✓ Mailto link format is correct', 'green');
      return true;
    }

    log('  ⚠ No mailto link found in help page', 'yellow');
    return true; // Not an error if missing
  }

  log('  ⚠ Help file not found', 'yellow');
  return false;
}

// Run the validation
function main() {
  // First check for the specific error
  const noSpecificError = checkForSpecificError();

  // Then validate all templates
  const allValid = validateAllHelpRelatedTemplates();

  // Exit with appropriate code
  if (allValid && noSpecificError) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

// Handle errors
process.on('uncaughtException', (error) => {
  log(`\n✗ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});

// Run the validation
main();
