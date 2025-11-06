// Request Validation Utility
import { ValidationError } from '../errors/index.js';
import { ERROR_MESSAGES } from './constants.js';

// Maximum request body size (1MB)
const MAX_BODY_SIZE = 1048576;

// Validate request size
export function validateRequestSize(request) {
  const contentLength = request.headers.get('content-length');

  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (isNaN(size) || size < 0) {
      throw new ValidationError('Invalid Content-Length header');
    }
    if (size > MAX_BODY_SIZE) {
      throw new ValidationError(
        `Request body too large. Maximum size is ${MAX_BODY_SIZE} bytes (1MB)`,
      );
    }
  }

  return true;
}

// Parse JSON body with proper error handling
export async function parseJsonBody(request) {
  // Validate request size first
  validateRequestSize(request);

  try {
    const body = await request.json();
    return body;
  } catch (error) {
    console.error('Failed to parse JSON body:', error);
    throw new ValidationError('Invalid JSON in request body');
  }
}

// Sanitize string input to prevent injection attacks
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

// Sanitize object by sanitizing all string values
export function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = obj[key];
      if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

// Validate and sanitize shop domain
export function validateAndSanitizeShop(shop) {
  if (!shop || typeof shop !== 'string') {
    throw new ValidationError(ERROR_MESSAGES.INVALID_SHOP);
  }

  const sanitized = sanitizeString(shop).toLowerCase();

  // Ensure it matches the expected format
  if (!/^[a-z0-9][a-z0-9]*(-[a-z0-9]+)*\.myshopify\.com$/.test(sanitized)) {
    throw new ValidationError(ERROR_MESSAGES.INVALID_SHOP);
  }

  return sanitized;
}

// Validate endpoint parameter for API proxy
export function validateEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') {
    throw new ValidationError(ERROR_MESSAGES.MISSING_ENDPOINT);
  }

  const sanitized = sanitizeString(endpoint);

  // Endpoint must start with /
  if (!sanitized.startsWith('/')) {
    throw new ValidationError('Endpoint must start with /');
  }

  // Prevent path traversal
  if (sanitized.includes('..')) {
    throw new ValidationError('Invalid endpoint: path traversal detected');
  }

  return sanitized;
}

// Validate HTTP method
export function validateHttpMethod(method) {
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  const upperMethod = method ? method.toUpperCase() : 'GET';

  if (!validMethods.includes(upperMethod)) {
    throw new ValidationError(`Invalid HTTP method: ${method}`);
  }

  return upperMethod;
}
