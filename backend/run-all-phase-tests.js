/**
 * Run all phase API regression tests (1-14).
 * Run: node run-all-phase-tests.js
 */
const { spawnSync } = require('child_process');
const path = require('path');

const TESTS = [
  'test-phase1-property-based-api.js',
  'test-phase2-batch-api.js',
  'test-phase3-status-automation-api.js',
  'test-phase4-remove-fields-api.js',
  'test-phase5-view-details-api.js',
  'test-phase6-transaction-normalization-api.js',
  'test-phase7-borrow-improvements-api.js',
  'test-phase8-notifications-api.js',
  'test-phase9-search-api.js',
  'test-phase10-reports-api.js',
  'test-phase11-serial-uniqueness-api.js',
  'test-phase12-performance-indexes-api.js',
  'test-phase13-legacy-data-migration-api.js',
  'test-phase14-full-integration-api.js',
  'test-borrow-asset-api.js'
];

const root = __dirname;
const results = [];

for (const file of TESTS) {
  const filePath = path.join(root, file);
  process.stdout.write(`\n=== ${file} ===\n`);
  const proc = spawnSync(process.execPath, [filePath], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (proc.stdout) process.stdout.write(proc.stdout);
  if (proc.stderr) process.stderr.write(proc.stderr);
  const ok = proc.status === 0;
  results.push({ file, ok, status: proc.status });
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n============================`);
console.log(`All phase tests: ${passed}/${results.length} passed`);
results.filter((r) => !r.ok).forEach((r) => {
  console.log(`FAILED: ${r.file} (exit ${r.status})`);
});
if (passed !== results.length) process.exitCode = 1;
