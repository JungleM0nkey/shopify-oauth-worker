/**
 * Unit tests for utils module
 */
import { describe, it, expect } from 'vitest';
import { 
  getCorsHeaders, 
  extractApiKey, 
  parseJsonBody,
  createJsonResponse,
  buildShopifyAuthUrl
} from '../../lib/utils.js';
import { createMockRequest } from '../utils/mocks.js';

describe('utils', () => {
  describe('getCorsHeaders', () => {
    it('should return correct CORS headers', () => {
      const headers = getCorsHeaders();
      
      expect(headers).toEqual({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
      });
    });
  });

  describe('extractApiKey', () => {
    it('should extract API key from Bearer token', () => {
      const request = createMockRequest('https://test.com', {
        headers: { 'Authorization': 'Bearer test-api-key-123' }
      });
      
      const apiKey = extractApiKey(request);
      expect(apiKey).toBe('test-api-key-123');
    });

    it('should return null for missing Authorization header', () => {
      const request = createMockRequest('https://test.com');
      
      const apiKey = extractApiKey(request);
      expect(apiKey).toBeNull();
    });

    it('should return null for non-Bearer authorization', () => {
      const request = createMockRequest('https://test.com', {
        headers: { 'Authorization': 'Basic dXNlcjpwYXNz' }
      });
      
      const apiKey = extractApiKey(request);
      expect(apiKey).toBeNull();
    });

    it('should return null for malformed Bearer token', () => {
      const request = createMockRequest('https://test.com', {
        headers: { 'Authorization': 'Bearer' }
      });
      
      const apiKey = extractApiKey(request);
      expect(apiKey).toBeNull();
    });
  });

  describe('parseJsonBody', () => {
    it('should parse valid JSON body', async () => {
      const testData = { shop: 'test-shop.myshopify.com' };
      const request = createMockRequest('https://test.com', {
        method: 'POST',
        body: JSON.stringify(testData),
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await parseJsonBody(request);
      expect(result).toEqual(testData);
    });

    it('should return empty object for invalid JSON', async () => {
      const request = createMockRequest('https://test.com', {
        method: 'POST',
        body: 'invalid-json',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await parseJsonBody(request);
      expect(result).toEqual({});
    });

    it('should return empty object for empty body', async () => {
      const request = createMockRequest('https://test.com', {
        method: 'POST'
      });
      
      const result = await parseJsonBody(request);
      expect(result).toEqual({});
    });
  });

  describe('createJsonResponse', () => {
    it('should create JSON response with default status', () => {
      const data = { success: true };
      const response = createJsonResponse(data, 200);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should create JSON response with custom status', () => {
      const data = { error: 'Not found' };
      const response = createJsonResponse(data, 404);
      
      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should create JSON response with additional headers', () => {
      const data = { data: 'test' };
      const headers = { 'X-Custom-Header': 'test-value' };
      const response = createJsonResponse(data, 200, headers);
      
      expect(response.headers.get('Content-Type')).toBe('application/json');
      expect(response.headers.get('X-Custom-Header')).toBe('test-value');
    });
  });

  describe('buildShopifyAuthUrl', () => {
    it('should build correct Shopify OAuth URL', () => {
      const url = buildShopifyAuthUrl(
        'test-shop.myshopify.com',
        'test-client-id',
        'read_products,write_orders',
        'https://test-worker.workers.dev/auth/callback',
        'random-state-123'
      );
      
      const parsedUrl = new URL(url);
      
      expect(parsedUrl.hostname).toBe('test-shop.myshopify.com');
      expect(parsedUrl.pathname).toBe('/admin/oauth/authorize');
      expect(parsedUrl.searchParams.get('client_id')).toBe('test-client-id');
      expect(parsedUrl.searchParams.get('scope')).toBe('read_products,write_orders');
      expect(parsedUrl.searchParams.get('redirect_uri')).toBe('https://test-worker.workers.dev/auth/callback');
      expect(parsedUrl.searchParams.get('state')).toBe('random-state-123');
    });

    it('should handle shop domain correctly', () => {
      const url = buildShopifyAuthUrl(
        'test-shop.myshopify.com',
        'test-client-id',
        'read_products',
        'https://test-worker.workers.dev/auth/callback',
        'state-123'
      );
      
      const parsedUrl = new URL(url);
      expect(parsedUrl.hostname).toBe('test-shop.myshopify.com');
    });
  });
});