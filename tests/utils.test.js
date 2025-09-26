// Tests for utils module
import { getCorsHeaders, extractApiKey, buildShopifyAuthUrl, createJsonResponse } from '../src/utils/index.js';

// Test CORS headers
console.log('Testing CORS headers...');
const corsHeaders = getCorsHeaders();
console.assert(corsHeaders['Access-Control-Allow-Origin'] === '*', 'CORS origin should be *');
console.assert(corsHeaders['Access-Control-Allow-Methods'].includes('GET'), 'CORS methods should include GET');
console.assert(corsHeaders['Access-Control-Allow-Headers'].includes('Authorization'), 'CORS headers should include Authorization');

// Test API key extraction
console.log('Testing API key extraction...');
const mockRequest = {
  headers: {
    get: (key) => key === 'Authorization' ? 'Bearer test-api-key-123' : null
  }
};
const mockRequestNoAuth = {
  headers: {
    get: () => null
  }
};
const mockRequestInvalidAuth = {
  headers: {
    get: (key) => key === 'Authorization' ? 'Invalid auth-header' : null
  }
};

console.assert(extractApiKey(mockRequest) === 'test-api-key-123', 'Should extract API key from Bearer token');
console.assert(extractApiKey(mockRequestNoAuth) === null, 'Should return null for missing auth header');
console.assert(extractApiKey(mockRequestInvalidAuth) === null, 'Should return null for invalid auth header');

// Test Shopify auth URL building
console.log('Testing Shopify auth URL building...');
const authUrl = buildShopifyAuthUrl('test-shop.myshopify.com', 'client-id', 'read_products', 'https://example.com/callback', 'state-123');
console.assert(authUrl.includes('test-shop.myshopify.com'), 'URL should contain shop domain');
console.assert(authUrl.includes('client_id=client-id'), 'URL should contain client ID');
console.assert(authUrl.includes('scope=read_products'), 'URL should contain scope');
console.assert(authUrl.includes('redirect_uri='), 'URL should contain redirect URI');
console.assert(authUrl.includes('state=state-123'), 'URL should contain state');

console.log('All utils tests passed!');