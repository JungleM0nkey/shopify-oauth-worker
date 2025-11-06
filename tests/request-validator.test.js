// Tests for request validation utility
import { describe, it, expect } from 'vitest';
import {
  validateRequestSize,
  sanitizeString,
  sanitizeObject,
  validateAndSanitizeShop,
  validateEndpoint,
  validateHttpMethod,
} from '../src/utils/request-validator.js';

describe('Request Validator', () => {
  describe('validateRequestSize', () => {
    it('should pass for valid content length', () => {
      const request = {
        headers: new Map([['content-length', '1000']]),
        get(key) {
          return this.headers.get(key);
        },
      };

      expect(() => validateRequestSize(request)).not.toThrow();
    });

    it('should throw for oversized request', () => {
      const request = {
        headers: new Map([['content-length', '2000000']]),
        get(key) {
          return this.headers.get(key);
        },
      };

      expect(() => validateRequestSize(request)).toThrow('Request body too large');
    });

    it('should throw for invalid content length', () => {
      const request = {
        headers: new Map([['content-length', 'invalid']]),
        get(key) {
          return this.headers.get(key);
        },
      };

      expect(() => validateRequestSize(request)).toThrow('Invalid Content-Length');
    });
  });

  describe('sanitizeString', () => {
    it('should remove null bytes', () => {
      const result = sanitizeString('hello\0world');
      expect(result).toBe('helloworld');
    });

    it('should trim whitespace', () => {
      const result = sanitizeString('  hello  ');
      expect(result).toBe('hello');
    });

    it('should return non-strings unchanged', () => {
      expect(sanitizeString(123)).toBe(123);
      expect(sanitizeString(null)).toBe(null);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize all string values', () => {
      const obj = {
        name: '  test  ',
        value: 'hello\0world',
        number: 123,
      };

      const result = sanitizeObject(obj);

      expect(result.name).toBe('test');
      expect(result.value).toBe('helloworld');
      expect(result.number).toBe(123);
    });

    it('should handle nested objects', () => {
      const obj = {
        nested: {
          value: '  test  ',
        },
      };

      const result = sanitizeObject(obj);

      expect(result.nested.value).toBe('test');
    });
  });

  describe('validateAndSanitizeShop', () => {
    it('should accept valid shop domains', () => {
      expect(validateAndSanitizeShop('test-shop.myshopify.com')).toBe('test-shop.myshopify.com');
      expect(validateAndSanitizeShop('shop123.myshopify.com')).toBe('shop123.myshopify.com');
    });

    it('should reject invalid shop domains', () => {
      expect(() => validateAndSanitizeShop('-invalid.myshopify.com')).toThrow();
      expect(() => validateAndSanitizeShop('invalid-.myshopify.com')).toThrow();
      expect(() => validateAndSanitizeShop('invalid.com')).toThrow();
    });

    it('should convert to lowercase', () => {
      expect(validateAndSanitizeShop('TEST-SHOP.myshopify.com')).toBe('test-shop.myshopify.com');
    });

    it('should throw for null or empty', () => {
      expect(() => validateAndSanitizeShop(null)).toThrow();
      expect(() => validateAndSanitizeShop('')).toThrow();
    });
  });

  describe('validateEndpoint', () => {
    it('should accept valid endpoints', () => {
      expect(validateEndpoint('/admin/products.json')).toBe('/admin/products.json');
      expect(validateEndpoint('/admin/orders/123.json')).toBe('/admin/orders/123.json');
    });

    it('should reject endpoints without leading slash', () => {
      expect(() => validateEndpoint('admin/products.json')).toThrow();
    });

    it('should reject path traversal attempts', () => {
      expect(() => validateEndpoint('/admin/../secrets.json')).toThrow('path traversal');
    });

    it('should throw for null or empty', () => {
      expect(() => validateEndpoint(null)).toThrow();
      expect(() => validateEndpoint('')).toThrow();
    });
  });

  describe('validateHttpMethod', () => {
    it('should accept valid HTTP methods', () => {
      expect(validateHttpMethod('GET')).toBe('GET');
      expect(validateHttpMethod('POST')).toBe('POST');
      expect(validateHttpMethod('put')).toBe('PUT');
      expect(validateHttpMethod('delete')).toBe('DELETE');
    });

    it('should reject invalid methods', () => {
      expect(() => validateHttpMethod('INVALID')).toThrow();
      expect(() => validateHttpMethod('TRACE')).toThrow();
    });

    it('should default to GET', () => {
      expect(validateHttpMethod()).toBe('GET');
      expect(validateHttpMethod(null)).toBe('GET');
    });
  });
});
