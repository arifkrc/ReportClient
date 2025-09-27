// Simple node test to assert dev-only globals are not attached when APP_CONFIG.READ_ONLY === true
const path = require('path');

// Load APP_CONFIG
const appConfig = require(path.join(__dirname, '..', 'config', 'app-config.js'));

if (!appConfig || typeof appConfig.APP_CONFIG === 'undefined') {
  console.error('Could not load APP_CONFIG from config/app-config.js');
  process.exit(2);
}

const APP_CONFIG = appConfig.APP_CONFIG;

if (!APP_CONFIG.READ_ONLY) {
  console.error('Test expects APP_CONFIG.READ_ONLY to be true for read-only client');
  process.exit(2);
}

// Simulate a window-like global so modules that try to attach to window use this object
global.window = {};

// Require modules that previously attached globals (they are already in the project)
// If they attach globals when READ_ONLY is true, the test will fail.
try {
  require(path.join(__dirname, '..', 'ui', 'core', 'product-lookup.js'));
  require(path.join(__dirname, '..', 'ui', 'tables', 'cycle-times-table.js'));
} catch (e) {
  // Some modules may assume DOM APIs and throw; ignore load errors but still check globals
}

// Check for dev-only globals
const failures = [];
if (typeof global.window.getProductByCode !== 'undefined') failures.push('window.getProductByCode should not be defined');
if (typeof global.window.getProductsByCodes !== 'undefined') failures.push('window.getProductsByCodes should not be defined');
if (typeof global.window.loadOperationsToSelect !== 'undefined') failures.push('window.loadOperationsToSelect should not be defined');

if (failures.length > 0) {
  console.error('Read-only globals test failed:');
  failures.forEach(f => console.error(' -', f));
  process.exit(1);
}

console.log('Read-only globals test passed');
process.exit(0);
