import { ValidationError } from '../errors/index.js';
import { ERROR_MESSAGES, API_KEY_TTL_DAYS } from '../utils/constants.js';
import { isValidShopDomain } from '../validation/index.js';
import { extractApiKey, parseJsonBody, createJsonResponse } from '../utils/index.js';
import { proxyToShopify } from '../shopify/api.js';

// Handle Extension Authentication
export async function handleExtensionAuth(request, env, corsHeaders) {
  const body = await parseJsonBody(request);
  const { shop } = body;
  
  if (!isValidShopDomain(shop)) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.INVALID_SHOP },
      400,
      corsHeaders
    );
  }
  
  // Check if shop is installed
  const shopData = await env.SHOPS.get(shop, 'json');
  if (!shopData) {
    return createJsonResponse(
      {
        error: ERROR_MESSAGES.APP_NOT_INSTALLED,
        install_url: `https://apps.shopify.com/${env.SHOPIFY_APP_HANDLE}`,
      },
      403,
      corsHeaders
    );
  }
  
  // Generate and store API key
  const apiKey = crypto.randomUUID();
  await env.API_KEYS.put(
    `key:${apiKey}`,
    JSON.stringify({
      shop,
      accessToken: shopData.accessToken,
      createdAt: new Date().toISOString(),
    }),
    { expirationTtl: 86400 * API_KEY_TTL_DAYS }
  );
  
  return createJsonResponse(
    { success: true, api_key: apiKey, shop },
    200,
    corsHeaders
  );
}

// Handle API Proxy
export async function handleAPIProxy(request, env, corsHeaders) {
  // Extract and validate API key
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.MISSING_AUTH },
      401,
      corsHeaders
    );
  }
  
  // Verify API key
  const keyData = await env.API_KEYS.get(`key:${apiKey}`, 'json');
  if (!keyData) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.INVALID_API_KEY },
      401,
      corsHeaders
    );
  }
  
  const { shop, accessToken } = keyData;
  
  // Parse request body
  const body = await parseJsonBody(request);
  const { endpoint, method = 'GET', data } = body;
  
  if (!endpoint) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.MISSING_ENDPOINT },
      400,
      corsHeaders
    );
  }
  
  // Proxy request to Shopify
  try {
    const shopifyResponse = await proxyToShopify(
      shop,
      endpoint,
      method,
      data,
      accessToken,
      env
    );
    
    return createJsonResponse(
      shopifyResponse.data,
      shopifyResponse.status,
      corsHeaders
    );
  } catch (error) {
    console.error('Proxy error:', error);
    return createJsonResponse(
      { error: ERROR_MESSAGES.FAILED_PROXY, details: error.message },
      500,
      corsHeaders
    );
  }
}