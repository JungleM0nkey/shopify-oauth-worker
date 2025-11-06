import { ValidationError } from '../errors/index.js';
import { ERROR_MESSAGES, API_KEY_TTL_DAYS } from '../utils/constants.js';
import { extractApiKey, createJsonResponse } from '../utils/index.js';
import {
  parseJsonBody,
  validateAndSanitizeShop,
  validateEndpoint,
  validateHttpMethod,
} from '../utils/request-validator.js';
import {
  checkRateLimit,
  createRateLimitResponse,
  addRateLimitHeaders,
} from '../utils/rate-limiter.js';
import { proxyToShopify } from '../shopify/api.js';

// Handle Extension Authentication
export async function handleExtensionAuth(request, env, corsHeaders, logger) {
  try {
    const body = await parseJsonBody(request);
    const { shop } = body;

    if (!shop) {
      return createJsonResponse({ error: ERROR_MESSAGES.INVALID_SHOP }, 400, corsHeaders);
    }

    // Validate and sanitize shop domain
    const sanitizedShop = validateAndSanitizeShop(shop);

    if (logger) {
      logger.info('Extension auth request', { shop: sanitizedShop });
    }

    // Check if shop is installed
    const shopData = await env.SHOPS.get(sanitizedShop, 'json');
    if (!shopData) {
      if (logger) {
        logger.warn('App not installed', { shop: sanitizedShop });
      }
      return createJsonResponse(
        {
          error: ERROR_MESSAGES.APP_NOT_INSTALLED,
          install_url: `https://apps.shopify.com/${env.SHOPIFY_APP_HANDLE}`,
        },
        403,
        corsHeaders,
      );
    }

    // Generate and store API key
    const apiKey = crypto.randomUUID();
    await env.API_KEYS.put(
      `key:${apiKey}`,
      JSON.stringify({
        shop: sanitizedShop,
        accessToken: shopData.accessToken,
        createdAt: new Date().toISOString(),
      }),
      { expirationTtl: 86400 * API_KEY_TTL_DAYS },
    );

    if (logger) {
      logger.info('API key generated', { shop: sanitizedShop });
    }

    return createJsonResponse(
      { success: true, api_key: apiKey, shop: sanitizedShop },
      200,
      corsHeaders,
    );
  } catch (error) {
    if (logger) {
      logger.error('Extension auth failed', { error: error.message });
    }
    if (error instanceof ValidationError) {
      return createJsonResponse({ error: error.message }, 400, corsHeaders);
    }
    throw error;
  }
}

// Handle API Proxy
export async function handleAPIProxy(request, env, corsHeaders, logger) {
  try {
    // Extract and validate API key
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      return createJsonResponse({ error: ERROR_MESSAGES.MISSING_AUTH }, 401, corsHeaders);
    }

    // Check rate limit
    const rateLimit = await checkRateLimit(apiKey, env);
    if (!rateLimit.allowed) {
      if (logger) {
        logger.warn('Rate limit exceeded', { apiKey: `${apiKey.substring(0, 8)}...` });
      }
      return createRateLimitResponse(rateLimit, corsHeaders);
    }

    // Verify API key
    const keyData = await env.API_KEYS.get(`key:${apiKey}`, 'json');
    if (!keyData) {
      return createJsonResponse({ error: ERROR_MESSAGES.INVALID_API_KEY }, 401, corsHeaders);
    }

    const { shop, accessToken } = keyData;

    if (logger) {
      logger.info('API proxy request', { shop, apiKey: `${apiKey.substring(0, 8)}...` });
    }

    // Parse request body with validation
    const body = await parseJsonBody(request);
    const { endpoint: rawEndpoint, method: rawMethod = 'GET', data } = body;

    // Validate and sanitize inputs
    const endpoint = validateEndpoint(rawEndpoint);
    const method = validateHttpMethod(rawMethod);

    // Proxy request to Shopify
    const shopifyResponse = await proxyToShopify(shop, endpoint, method, data, accessToken, env);

    if (logger) {
      logger.info('Shopify API response', {
        shop,
        endpoint,
        status: shopifyResponse.status,
        ok: shopifyResponse.ok,
      });
    }

    // Add rate limit headers to response
    const headers = addRateLimitHeaders(corsHeaders, rateLimit);

    return createJsonResponse(shopifyResponse.data, shopifyResponse.status, headers);
  } catch (error) {
    if (logger) {
      logger.error('Proxy error', { error: error.message, stack: error.stack });
    } else {
      console.error('Proxy error:', error);
    }

    if (error instanceof ValidationError) {
      return createJsonResponse({ error: error.message }, 400, corsHeaders);
    }

    return createJsonResponse(
      { error: ERROR_MESSAGES.FAILED_PROXY, details: error.message },
      500,
      corsHeaders,
    );
  }
}
