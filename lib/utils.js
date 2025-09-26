/**
 * Common utility functions for the Shopify OAuth Worker
 * @module utils
 */

/**
 * Returns CORS headers for cross-origin requests from browser extensions
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  };
}

/**
 * Extracts API key from Authorization header
 * @param {Request} request - HTTP request object
 * @returns {string|null} API key or null if invalid/missing
 */
export function extractApiKey(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Safely parses JSON body from request with error handling
 * @param {Request} request - HTTP request object
 * @returns {Promise<Object>} Parsed JSON object or empty object if invalid
 */
export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

/**
 * Creates a JSON response with proper headers
 * @param {*} data - Data to serialize as JSON
 * @param {number} status - HTTP status code
 * @param {Object} headers - Additional headers to include
 * @returns {Response} Response object with JSON content
 */
export function createJsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Builds Shopify OAuth authorization URL
 * @param {string} shop - Shop domain
 * @param {string} clientId - Shopify app client ID
 * @param {string} scope - Comma-separated permission scopes
 * @param {string} redirectUri - OAuth callback URL
 * @param {string} state - CSRF protection state parameter
 * @returns {string} Complete OAuth authorization URL
 */
export function buildShopifyAuthUrl(shop, clientId, scope, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}