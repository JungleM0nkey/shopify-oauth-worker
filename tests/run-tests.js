#!/usr/bin/env node
// Test runner for all modules
console.log('Running all tests...\n');

try {
  console.log('1. Running validation tests...');
  await import('./validation.test.js');
  console.log('✓ Validation tests passed\n');

  console.log('2. Running utils tests...');
  await import('./utils.test.js');
  console.log('✓ Utils tests passed\n');

  console.log('3. Running error tests...');
  await import('./errors.test.js');
  console.log('✓ Error tests passed\n');

  console.log('🎉 All tests passed!');
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
}
