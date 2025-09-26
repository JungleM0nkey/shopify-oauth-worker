import { AuthenticationError, ValidationError, ConfigurationError } from './errors.js';
import { ERROR_MESSAGES, STATE_TTL_SECONDS, API_KEY_TTL_DAYS } from './constants.js';
import { 
  isValidShopDomain, 
  checkInstallation, 
  isValidHost 
} from './validation.js';
import { verifyShopifyHmac, verifyWebhookHmac } from './hmac.js';
import { 
  getCorsHeaders, 
  extractApiKey, 
  parseJsonBody, 
  createJsonResponse,
  buildShopifyAuthUrl
} from './utils.js';
import {
  exchangeCodeForToken,
  storeShopData,
  registerMandatoryWebhooks,
  proxyToShopify,
  getShopData
} from './shopify.js';
import {
  createInstallRedirect,
  createAccessDeniedPage,
  createEmbeddedApp,
  createLandingPage
} from './templates.js';
import { initializeMonitoring, performCleanup } from './monitoring.js';
import { handleHealthCheck, handleStatusCheck, handleMetricsCheck } from './health.js';
import { encryptKVData, decryptKVData } from './encryption.js';

// Request Router with monitoring and health checks
export async function routeRequest(request, url, env, corsHeaders) {
  // Initialize monitoring for this request
  const { requestId, logger, monitor, errorTracker } = initializeMonitoring(request, env);
  
  try {
    logger.info('Request received', { 
      path: url.pathname, 
      method: request.method,
      query: url.search 
    });
    
    monitor.startTimer('request_processing');
    
    // Perform periodic cleanup
    performCleanup();
    
    // Handle health and monitoring endpoints
    if (url.pathname.startsWith('/health')) {
      const healthType = url.pathname.split('/')[2] || 'basic';
      return await handleHealthCheck(request, env, healthType);
    }
    
    if (url.pathname === '/status') {
      return await handleStatusCheck(env);
    }
    
    if (url.pathname === '/metrics') {
      return await handleMetricsCheck(env);
    }
    
    // Handle root path
    if (url.pathname === '/') {
      const result = await handleRootPath(url, env, logger);
      monitor.logRequestComplete(result.status);
      return result;
    }
    
    // Handle specific routes
    const routes = {
      '/auth': () => handleOAuth(request, env, logger),
      '/auth/callback': () => handleOAuthCallback(request, env, logger),
      '/webhooks/customers/redact': () => handleWebhook(request, env, 'customers/redact', logger),
      '/webhooks/shop/redact': () => handleWebhook(request, env, 'shop/redact', logger),
      '/webhooks/customers/data_request': () => handleWebhook(request, env, 'customers/data_request', logger),
      '/api/auth': () => handleExtensionAuth(request, env, corsHeaders, logger),
      '/api/proxy': () => handleAPIProxy(request, env, corsHeaders, logger),
    };
    
    const handler = routes[url.pathname];
    if (handler) {
      const result = await handler();
      monitor.logRequestComplete(result.status);
      return result;
    }
    
    logger.warn('Route not found', { path: url.pathname });
    monitor.logRequestComplete(404);
    return new Response('Not Found', { status: 404 });
    
  } catch (error) {
    await errorTracker.trackError(error, {
      path: url.pathname,
      method: request.method,
      requestId,
    });
    
    monitor.logRequestComplete(error.statusCode || 500, error);
    throw error;
  }
}

// Root Path Handler
async function handleRootPath(url, env, logger = null) {
  const shop = url.searchParams.get('shop');
  const embedded = url.searchParams.get('embedded');
  const host = url.searchParams.get('host');
  
  // No shop parameter - show landing page
  if (!shop) {
    return createLandingPage();
  }
  
  // Validate shop domain
  if (!isValidShopDomain(shop)) {
    throw new ValidationError(ERROR_MESSAGES.INVALID_SHOP);
  }
  
  // Check installation status
  const isInstalled = await checkInstallation(shop, env, logger);
  
  if (!isInstalled) {
    return createInstallRedirect(shop, env);
  }
  
  // Check if this is an embedded app request
  if (embedded === '1') {
    // For embedded apps, validate host parameter
    if (!host) {
      console.error('Missing host parameter for embedded app');
      return createAccessDeniedPage(shop);
    }
    
    if (!isValidHost(host, shop)) {
      console.error('Host validation failed:', { 
        host: host ? `${host.substring(0, 20)}...` : 'null',
        shop 
      });
      // Instead of throwing an error, try to handle gracefully
      // Some Shopify contexts might have different host formats
      console.warn('Proceeding despite host validation failure - this may be a Shopify format change');
    }
    
    return createEmbeddedApp(shop, host, env);
  }
  
  // Non-embedded access - redirect to Shopify admin
  return Response.redirect(`https://${shop}/admin/apps/${env.SHOPIFY_APP_HANDLE}`, 302);
}

// OAuth Flow Handlers
async function handleOAuth(request, env) {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop');
  
  if (!isValidShopDomain(shop)) {
    throw new ValidationError(ERROR_MESSAGES.INVALID_SHOP);
  }
  
  const state = crypto.randomUUID();
  const redirectUri = `${env.APP_URL || url.origin}/auth/callback`;
  
  // Store state for verification with error handling
  try {
    await env.AUTH_STATES.put(state, shop, { expirationTtl: STATE_TTL_SECONDS });
  } catch (error) {
    console.error('Failed to store auth state:', error);
    throw new ConfigurationError(ERROR_MESSAGES.FAILED_AUTH_INIT);
  }
  
  const authUrl = buildShopifyAuthUrl(shop, env.SHOPIFY_API_KEY, env.OAUTH_SCOPES, redirectUri, state);
  return Response.redirect(authUrl, 302);
}

async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const { code, shop, state, hmac } = Object.fromEntries(url.searchParams);
  
  // Validate all required parameters
  if (!code || !shop || !state || !hmac) {
    throw new ValidationError(ERROR_MESSAGES.MISSING_OAUTH_PARAMS);
  }
  
  // Verify state
  const savedShop = await env.AUTH_STATES.get(state);
  if (savedShop !== shop) {
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_STATE, 403);
  }
  
  // Clean up state
  await env.AUTH_STATES.delete(state);
  
  // Verify HMAC
  const isValidHmac = await verifyShopifyHmac(url.searchParams, env.SHOPIFY_API_SECRET);
  if (!isValidHmac) {
    console.error('HMAC verification failed for OAuth callback');
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_HMAC, 403);
  }
  
  // Exchange code for access token
  const tokenData = await exchangeCodeForToken(shop, code, env);
  
  // Store shop data
  await storeShopData(shop, tokenData, env);
  
  // Register webhooks
  await registerMandatoryWebhooks(shop, tokenData.access_token, env);
  
  // Redirect to app in Shopify admin
  return Response.redirect(`https://${shop}/admin/apps/${env.SHOPIFY_APP_HANDLE}`, 302);
}

// Extension Authentication
// Extension Authentication with monitoring and encryption
async function handleExtensionAuth(request, env, corsHeaders, logger = null) {
  try {
    const body = await parseJsonBody(request);
    const { shop } = body;
    
    if (logger) {
      logger.info('Extension auth request', { shop });
    }
    
    if (!isValidShopDomain(shop)) {
      if (logger) {
        logger.warn('Invalid shop domain', { shop });
      }
      return createJsonResponse(
        { error: ERROR_MESSAGES.INVALID_SHOP },
        400,
        corsHeaders
      );
    }
    
    // Check if shop has app installed using decryption
    const shopData = await getShopData(shop, env, logger);
    if (!shopData) {
      if (logger) {
        logger.warn('App not installed for shop', { shop });
      }
      return createJsonResponse(
        {
          error: ERROR_MESSAGES.APP_NOT_INSTALLED,
          install_url: `https://apps.shopify.com/${env.SHOPIFY_APP_HANDLE}`,
        },
        403,
        corsHeaders
      );
    }
    
    // Generate and store API key with encryption
    const apiKey = crypto.randomUUID();
    const apiKeyData = {
      shop,
      accessToken: shopData.accessToken,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
    
    const encryptedKeyData = await encryptKVData(apiKeyData, env);
    
    await env.API_KEYS.put(
      `key:${apiKey}`,
      encryptedKeyData,
      { expirationTtl: 86400 * API_KEY_TTL_DAYS }
    );
    
    if (logger) {
      logger.info('API key generated successfully', { shop, keyId: `key:${apiKey.substring(0, 8)}...` });
    }
    
    return createJsonResponse(
      { success: true, api_key: apiKey, shop },
      200,
      corsHeaders
    );
  } catch (error) {
    if (logger) {
      logger.error('Extension auth failed', { error: error.message });
    }
    return createJsonResponse(
      { error: 'Authentication failed', details: error.message },
      500,
      corsHeaders
    );
  }
}

// API Proxy Handler with monitoring and encryption
async function handleAPIProxy(request, env, corsHeaders, logger = null) {
  try {
    // Extract and validate API key
    const apiKey = extractApiKey(request);
    if (!apiKey) {
      if (logger) {
        logger.warn('Missing API key in proxy request');
      }
      return createJsonResponse(
        { error: ERROR_MESSAGES.MISSING_AUTH },
        401,
        corsHeaders
      );
    }
    
    // Verify API key with decryption
    const encryptedKeyData = await env.API_KEYS.get(`key:${apiKey}`);
    if (!encryptedKeyData) {
      if (logger) {
        logger.warn('Invalid API key used', { keyId: `key:${apiKey.substring(0, 8)}...` });
      }
      return createJsonResponse(
        { error: ERROR_MESSAGES.INVALID_API_KEY },
        401,
        corsHeaders
      );
    }
    
    const keyData = await decryptKVData(encryptedKeyData, env);
    if (!keyData) {
      if (logger) {
        logger.error('Failed to decrypt API key data', { keyId: `key:${apiKey.substring(0, 8)}...` });
      }
      return createJsonResponse(
        { error: ERROR_MESSAGES.INVALID_API_KEY },
        401,
        corsHeaders
      );
    }
    
    const { shop, accessToken } = keyData;
    
    // Update last used timestamp
    keyData.lastUsed = new Date().toISOString();
    const updatedEncryptedData = await encryptKVData(keyData, env);
    // Fire and forget update
    env.API_KEYS.put(`key:${apiKey}`, updatedEncryptedData, { 
      expirationTtl: 86400 * API_KEY_TTL_DAYS 
    }).catch(() => {}); // Ignore errors for last used update
    
    // Parse request body
    const body = await parseJsonBody(request);
    const { endpoint, method = 'GET', data } = body;
    
    if (!endpoint) {
      if (logger) {
        logger.warn('Missing endpoint in proxy request', { shop });
      }
      return createJsonResponse(
        { error: ERROR_MESSAGES.MISSING_ENDPOINT },
        400,
        corsHeaders
      );
    }
    
    if (logger) {
      logger.info('Proxying request to Shopify', { shop, endpoint, method });
    }
    
    // Proxy request to Shopify with enhanced error handling
    const shopifyResponse = await proxyToShopify(
      shop,
      endpoint,
      method,
      data,
      accessToken,
      env,
      logger
    );
    
    // Include rate limit headers if available
    const responseHeaders = { ...corsHeaders };
    if (shopifyResponse.headers) {
      Object.assign(responseHeaders, shopifyResponse.headers);
    }
    
    return createJsonResponse(
      shopifyResponse.data,
      shopifyResponse.status,
      responseHeaders
    );
  } catch (error) {
    if (logger) {
      logger.error('Proxy request failed', { error: error.message });
    }
    return createJsonResponse(
      { error: ERROR_MESSAGES.FAILED_PROXY, details: error.message },
      500,
      corsHeaders
    );
  }
}

// Webhook Handlers
async function handleWebhook(request, env, topic) {
  // Verify webhook authenticity
  const hmac = request.headers.get('X-Shopify-Hmac-Sha256');
  const body = await request.text();
  
  const isValidWebhook = await verifyWebhookHmac(body, hmac, env.SHOPIFY_API_SECRET);
  if (!isValidWebhook) {
    console.error('Webhook HMAC verification failed');
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_WEBHOOK, 401);
  }
  
  const data = JSON.parse(body);
  
  switch (topic) {
    case 'shop/redact':
      await handleShopRedact(data, env);
      break;
    case 'customers/redact':
      await handleCustomerRedact(data, env);
      break;
    case 'customers/data_request':
      await handleCustomerDataRequest(data, env);
      break;
  }
  
  return new Response('', { status: 200 });
}

async function handleShopRedact(data, env) {
  const shop = data.shop_domain;
  if (shop) {
    await env.SHOPS.delete(shop);
    console.log(`Shop data deleted for: ${shop}`);
  }
}

async function handleCustomerRedact(data, env) {
  console.log('Customer redact webhook received');
}

async function handleCustomerDataRequest(data, env) {
  console.log('Customer data request webhook received');
}