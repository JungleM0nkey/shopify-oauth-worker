// Tests for CORS utility
import { describe, it, expect } from 'vitest';
import { getCorsHeaders, validateCorsConfig } from '../src/utils/cors.js';

describe('CORS Utility', () => {
  describe('getCorsHeaders', () => {
    it('should allow wildcard when ALLOWED_ORIGINS is *', () => {
      const request = {
        headers: new Map([['Origin', 'https://example.com']]),
        get(key) {
          return this.headers.get(key);
        },
      };
      const env = { ALLOWED_ORIGINS: '*' };

      const headers = getCorsHeaders(request, env);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
    });

    it('should allow specific origin when in whitelist', () => {
      const request = {
        headers: new Map([['Origin', 'https://app.example.com']]),
        get(key) {
          return this.headers.get(key);
        },
      };
      const env = { ALLOWED_ORIGINS: 'https://app.example.com,https://other.com' };

      const headers = getCorsHeaders(request, env);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    });

    it('should deny origin not in whitelist', () => {
      const request = {
        headers: new Map([['Origin', 'https://malicious.com']]),
        get(key) {
          return this.headers.get(key);
        },
      };
      const env = { ALLOWED_ORIGINS: 'https://app.example.com' };

      const headers = getCorsHeaders(request, env);

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
    });

    it('should support subdomain wildcards', () => {
      const request = {
        headers: new Map([['Origin', 'https://sub.example.com']]),
        get(key) {
          return this.headers.get(key);
        },
      };
      const env = { ALLOWED_ORIGINS: '*.example.com' };

      const headers = getCorsHeaders(request, env);

      expect(headers['Access-Control-Allow-Origin']).toBe('https://sub.example.com');
    });
  });

  describe('validateCorsConfig', () => {
    it('should warn when ALLOWED_ORIGINS is not set', () => {
      const env = {};
      const result = validateCorsConfig(env);
      expect(result).toBe(false);
    });

    it('should warn when using wildcard', () => {
      const env = { ALLOWED_ORIGINS: '*' };
      const result = validateCorsConfig(env);
      // Returns true but logs warning
      expect(result).toBe(true);
    });

    it('should pass when properly configured', () => {
      const env = { ALLOWED_ORIGINS: 'https://example.com' };
      const result = validateCorsConfig(env);
      expect(result).toBe(true);
    });
  });
});
