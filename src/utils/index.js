// Utility Functions
import { getCorsHeaders as getSecureCorsHeaders } from './cors.js';
import { parseJsonBody as parseJsonBodySecure } from './request-validator.js';

// CORS Headers (secure version with origin validation)
export function getCorsHeaders(request, env) {
  return getSecureCorsHeaders(request, env);
}

// Legacy version for backward compatibility (deprecated)
export function getCorsHeadersLegacy() {
  console.warn(
    'getCorsHeadersLegacy() is deprecated and insecure. Use getCorsHeaders(request, env) instead.',
  );
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  };
}

// Extract API Key from Authorization Header
export function extractApiKey(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Parse JSON Body with Error Handling (secure version)
export async function parseJsonBody(request) {
  return parseJsonBodySecure(request);
}

// Create JSON Response
export function createJsonResponse(data, status, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

// Build Shopify Auth URL
export function buildShopifyAuthUrl(shop, clientId, scope, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}
