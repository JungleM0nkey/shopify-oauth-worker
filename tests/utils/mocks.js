/**
 * Mock utilities for testing Cloudflare Worker functionality
 */

/**
 * Creates a mock KV namespace for testing
 * @returns {Object} Mock KV namespace
 */
export function createMockKV() {
  const storage = new Map();
  
  return {
    get: vi.fn(async (key) => storage.get(key) || null),
    put: vi.fn(async (key, value, options = {}) => {
      storage.set(key, value);
    }),
    delete: vi.fn(async (key) => storage.delete(key)),
    list: vi.fn(async () => ({ keys: Array.from(storage.keys()) }))
  };
}

/**
 * Creates a mock environment object for testing
 * @returns {Object} Mock environment
 */
export function createMockEnv() {
  return {
    SHOPIFY_API_KEY: 'test-api-key',
    SHOPIFY_API_SECRET: 'test-api-secret',
    SHOPIFY_APP_HANDLE: 'test-app',
    APP_URL: 'https://test-worker.workers.dev',
    OAUTH_SCOPES: 'read_products,write_orders',
    SHOPIFY_API_VERSION: '2025-07',
    SHOPS: createMockKV(),
    AUTH_STATES: createMockKV(),
    API_KEYS: createMockKV()
  };
}

/**
 * Creates a mock Request object
 * @param {string} url - Request URL
 * @param {Object} options - Request options
 * @returns {Request} Mock Request
 */
export function createMockRequest(url, options = {}) {
  return new Request(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body
  });
}

/**
 * Creates a mock Response object
 * @param {any} body - Response body
 * @param {Object} options - Response options
 * @returns {Response} Mock Response
 */
export function createMockResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
}

/**
 * Mock fetch function for testing API calls
 * @param {string} url - Request URL
 * @param {Object} options - Request options
 * @returns {Promise<Response>} Mock response
 */
export function mockFetch(url, options = {}) {
  // Default successful Shopify API responses
  if (url.includes('/admin/oauth/access_token')) {
    return Promise.resolve(createMockResponse({
      access_token: 'test-access-token',
      scope: 'read_products,write_orders'
    }));
  }
  
  if (url.includes('/admin/api/')) {
    return Promise.resolve(createMockResponse({
      products: [
        { id: 1, title: 'Test Product' }
      ]
    }));
  }
  
  return Promise.resolve(new Response('Not Found', { status: 404 }));
}

/**
 * Helper to setup global mocks for tests
 */
export function setupGlobalMocks() {
  global.fetch = vi.fn(mockFetch);
  
  // Mock crypto.subtle for HMAC verification - use defineProperty to override readonly
  Object.defineProperty(global, 'crypto', {
    value: {
      subtle: {
        importKey: vi.fn().mockResolvedValue({}),
        sign: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        verify: vi.fn().mockResolvedValue(true)
      }
    },
    writable: true,
    configurable: true
  });
  
  // Mock base64 functions
  global.btoa = vi.fn((str) => Buffer.from(str).toString('base64'));
  global.atob = vi.fn((str) => Buffer.from(str, 'base64').toString());
}