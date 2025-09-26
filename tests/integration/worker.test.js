/**
 * Integration tests for the main worker functionality
 */
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../../worker.js';
import { createMockEnv, createMockRequest, setupGlobalMocks } from '../utils/mocks.js';

describe('Worker Integration Tests', () => {
  let mockEnv;

  beforeEach(() => {
    setupGlobalMocks();
    mockEnv = createMockEnv();
  });

  describe('CORS preflight requests', () => {
    it('should handle OPTIONS requests with CORS headers', async () => {
      const request = createMockRequest('https://test-worker.workers.dev/api/auth', {
        method: 'OPTIONS'
      });

      const response = await worker.fetch(request, mockEnv, {});

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization, X-API-Key');
    });
  });

  describe('Root endpoint', () => {
    it('should return landing page for root path', async () => {
      const request = createMockRequest('https://test-worker.workers.dev/');

      const response = await worker.fetch(request, mockEnv, {});

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/html');
    });

    it('should handle embedded app context', async () => {
      const request = createMockRequest(
        'https://test-worker.workers.dev/?embedded=1&shop=test-shop.myshopify.com&host=dGVzdC1zaG9wLm15c2hvcGlmeS5jb20vYWRtaW4%3D&hmac=test-hmac'
      );

      const response = await worker.fetch(request, mockEnv, {});

      expect(response.status).toBe(200);
    });
  });

  describe('OAuth endpoints', () => {
    it('should initiate OAuth flow', async () => {
      const request = createMockRequest(
        'https://test-worker.workers.dev/auth?shop=test-shop.myshopify.com'
      );

      const response = await worker.fetch(request, mockEnv, {});

      expect(response.status).toBe(302); // Redirect to Shopify
      expect(response.headers.get('Location')).toContain('test-shop.myshopify.com');
      expect(response.headers.get('Location')).toContain('/admin/oauth/authorize');
    });

    it('should handle OAuth callback', async () => {
      // First store a state in the mock KV
      await mockEnv.AUTH_STATES.put('test-state', JSON.stringify({
        shop: 'test-shop.myshopify.com',
        createdAt: Date.now()
      }));

      const request = createMockRequest(
        'https://test-worker.workers.dev/auth/callback?code=test-code&shop=test-shop.myshopify.com&state=test-state&hmac=abcdef1234567890'
      );

      const response = await worker.fetch(request, mockEnv, {});

      expect(response.status).toBe(302); // Redirect after successful auth
    });
  });

  describe('API endpoints', () => {
    it('should handle extension authentication', async () => {
      // Pre-populate shop data
      await mockEnv.SHOPS.put('test-shop.myshopify.com', JSON.stringify({
        accessToken: 'test-access-token',
        scope: 'read_products'
      }));

      const request = createMockRequest('https://test-worker.workers.dev/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shop: 'test-shop.myshopify.com' })
      });

      const response = await worker.fetch(request, mockEnv, {});
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('api_key');
    });

    it('should proxy API requests', async () => {
      // Pre-populate API key
      const apiKey = 'test-api-key';
      await mockEnv.API_KEYS.put(apiKey, JSON.stringify({
        shop: 'test-shop.myshopify.com',
        createdAt: Date.now()
      }));

      // Pre-populate shop data
      await mockEnv.SHOPS.put('test-shop.myshopify.com', JSON.stringify({
        accessToken: 'test-access-token',
        scope: 'read_products'
      }));

      const request = createMockRequest('https://test-worker.workers.dev/api/proxy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          endpoint: '/products.json',
          method: 'GET'
        })
      });

      const response = await worker.fetch(request, mockEnv, {});

      expect(response.status).toBe(200);
    });
  });

  describe('Error handling', () => {
    it('should handle missing environment variables', async () => {
      const incompleteEnv = {
        SHOPIFY_API_KEY: 'test'
        // Missing other required variables
      };

      const request = createMockRequest('https://test-worker.workers.dev/');

      const response = await worker.fetch(request, incompleteEnv, {});

      expect(response.status).toBe(500);
    });

    it('should handle invalid routes', async () => {
      const request = createMockRequest('https://test-worker.workers.dev/invalid-route');

      const response = await worker.fetch(request, mockEnv, {});

      expect(response.status).toBe(404);
    });
  });
});