// Tests for utils module
import { describe, it, expect } from 'vitest';
import {
  getCorsHeaders,
  extractApiKey,
  buildShopifyAuthUrl,
  createJsonResponse,
} from '../src/utils/index.js';

describe('Utility Functions', () => {
  describe('getCorsHeaders', () => {
    it('should return CORS headers with proper configuration', () => {
      const mockRequest = {
        headers: new Map([['Origin', 'https://example.com']]),
        get(key) {
          return this.headers.get(key);
        },
      };
      const env = { ALLOWED_ORIGINS: '*' };

      const corsHeaders = getCorsHeaders(mockRequest, env);

      expect(corsHeaders['Access-Control-Allow-Methods']).toContain('GET');
      expect(corsHeaders['Access-Control-Allow-Headers']).toContain('Authorization');
    });
  });

  describe('extractApiKey', () => {
    it('should extract API key from Bearer token', () => {
      const mockRequest = {
        headers: {
          get: (key) => (key === 'Authorization' ? 'Bearer test-api-key-123' : null),
        },
      };

      expect(extractApiKey(mockRequest)).toBe('test-api-key-123');
    });

    it('should return null for missing auth header', () => {
      const mockRequestNoAuth = {
        headers: {
          get: () => null,
        },
      };

      expect(extractApiKey(mockRequestNoAuth)).toBeNull();
    });

    it('should return null for invalid auth header', () => {
      const mockRequestInvalidAuth = {
        headers: {
          get: (key) => (key === 'Authorization' ? 'Invalid auth-header' : null),
        },
      };

      expect(extractApiKey(mockRequestInvalidAuth)).toBeNull();
    });
  });

  describe('buildShopifyAuthUrl', () => {
    it('should build valid auth URL with all parameters', () => {
      const authUrl = buildShopifyAuthUrl(
        'test-shop.myshopify.com',
        'client-id',
        'read_products',
        'https://example.com/callback',
        'state-123',
      );

      expect(authUrl).toContain('test-shop.myshopify.com');
      expect(authUrl).toContain('client_id=client-id');
      expect(authUrl).toContain('scope=read_products');
      expect(authUrl).toContain('redirect_uri=');
      expect(authUrl).toContain('state=state-123');
    });
  });

  describe('createJsonResponse', () => {
    it('should create JSON response with correct status', () => {
      const data = { success: true };
      const response = createJsonResponse(data, 200);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should include custom headers', () => {
      const data = { error: 'Not found' };
      const customHeaders = { 'X-Custom': 'value' };
      const response = createJsonResponse(data, 404, customHeaders);

      expect(response.status).toBe(404);
      expect(response.headers.get('X-Custom')).toBe('value');
    });
  });
});
