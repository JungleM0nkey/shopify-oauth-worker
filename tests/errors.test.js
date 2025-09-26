// Tests for error classes
import { AuthenticationError, ValidationError, ConfigurationError } from '../src/errors/index.js';

// Test AuthenticationError
console.log('Testing AuthenticationError...');
const authError = new AuthenticationError('Test auth error');
console.assert(authError.name === 'AuthenticationError', 'Error name should be AuthenticationError');
console.assert(authError.message === 'Test auth error', 'Error message should be preserved');
console.assert(authError.statusCode === 401, 'Default status code should be 401');

const authErrorCustomStatus = new AuthenticationError('Test error', 403);
console.assert(authErrorCustomStatus.statusCode === 403, 'Custom status code should be preserved');

// Test ValidationError
console.log('Testing ValidationError...');
const validationError = new ValidationError('Test validation error');
console.assert(validationError.name === 'ValidationError', 'Error name should be ValidationError');
console.assert(validationError.message === 'Test validation error', 'Error message should be preserved');
console.assert(validationError.statusCode === 400, 'Default status code should be 400');

// Test ConfigurationError
console.log('Testing ConfigurationError...');
const configError = new ConfigurationError('Test config error');
console.assert(configError.name === 'ConfigurationError', 'Error name should be ConfigurationError');
console.assert(configError.message === 'Test config error', 'Error message should be preserved');
console.assert(configError.statusCode === 500, 'Default status code should be 500');

// Test error inheritance
console.assert(authError instanceof Error, 'AuthenticationError should inherit from Error');
console.assert(validationError instanceof Error, 'ValidationError should inherit from Error');
console.assert(configError instanceof Error, 'ConfigurationError should inherit from Error');

console.log('All error tests passed!');