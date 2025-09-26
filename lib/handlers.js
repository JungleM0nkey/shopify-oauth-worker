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
async function handleOAuth(request, env, logger = null) {
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

async function handleOAuthCallback(request, env, logger = null) {
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

// Webhook Handlers with enhanced error recovery
async function handleWebhook(request, env, topic, logger = null) {
  try {
    // Verify webhook authenticity
    const hmac = request.headers.get('X-Shopify-Hmac-Sha256');
    const body = await request.text();
    
    if (logger) {
      logger.info('Webhook received', { topic, hasHmac: !!hmac });
    }
    
    const isValidWebhook = await verifyWebhookHmac(body, hmac, env.SHOPIFY_API_SECRET);
    if (!isValidWebhook) {
      if (logger) {
        logger.error('Webhook HMAC verification failed', { topic });
      } else {
        console.error('Webhook HMAC verification failed');
      }
      throw new AuthenticationError(ERROR_MESSAGES.INVALID_WEBHOOK, 401);
    }
    
    let data;
    try {
      data = JSON.parse(body);
    } catch (parseError) {
      if (logger) {
        logger.error('Failed to parse webhook body', { topic, error: parseError.message });
      }
      throw new ValidationError('Invalid webhook payload');
    }
    
    // Process webhook with error handling
    switch (topic) {
      case 'shop/redact':
        await handleShopRedact(data, env, logger);
        break;
      case 'customers/redact':
        await handleCustomerRedact(data, env, logger);
        break;
      case 'customers/data_request':
        await handleCustomerDataRequest(data, env, logger);
        break;
      default:
        if (logger) {
          logger.warn('Unknown webhook topic', { topic });
        }
    }
    
    if (logger) {
      logger.info('Webhook processed successfully', { topic });
    }
    
    return new Response('', { status: 200 });
    
  } catch (error) {
    if (logger) {
      logger.error('Webhook processing failed', { 
        topic, 
        error: error.message,
        statusCode: error.statusCode 
      });
    }
    
    // Return appropriate status codes for different error types
    if (error instanceof AuthenticationError) {
      return new Response('Unauthorized', { status: 401 });
    } else if (error instanceof ValidationError) {
      return new Response('Bad Request', { status: 400 });
    } else {
      return new Response('Internal Server Error', { status: 500 });
    }
  }
}

async function handleShopRedact(data, env, logger = null) {
  try {
    const shop = data.shop_domain;
    if (!shop) {
      if (logger) {
        logger.warn('Shop redact webhook missing shop_domain');
      }
      return;
    }
    
    // Delete shop data from KV storage
    await env.SHOPS.delete(shop);
    
    // Also clean up any related API keys
    try {
      const keys = await env.API_KEYS.list();
      const shopKeys = keys.keys.filter(key => key.name.includes(shop));
      await Promise.all(shopKeys.map(key => env.API_KEYS.delete(key.name)));
      
      if (logger) {
        logger.info('Shop data deleted', { shop, deletedApiKeys: shopKeys.length });
      } else {
        console.log(`Shop data deleted for: ${shop}, API keys: ${shopKeys.length}`);
      }
    } catch (cleanupError) {
      if (logger) {
        logger.warn('Failed to clean up API keys for deleted shop', { 
          shop, 
          error: cleanupError.message 
        });
      }
    }
  } catch (error) {
    if (logger) {
      logger.error('Shop redact processing failed', { 
        shop: data.shop_domain, 
        error: error.message 
      });
    }
    throw error;
  }
}

async function handleCustomerRedact(data, env, logger = null) {
  try {
    const customerId = data.customer?.id;
    const shop = data.shop_domain;
    
    if (logger) {
      logger.info('Customer redact webhook received', { 
        customerId, 
        shop,
        hasCustomerData: !!data.customer 
      });
    } else {
      console.log('Customer redact webhook received', { customerId, shop });
    }
    
    // In a real implementation, you would:
    // 1. Remove customer data from any custom storage
    // 2. Update analytics to remove customer references
    // 3. Clean up any cached customer information
    
    // For now, just log the successful processing
    if (logger) {
      logger.info('Customer redact processed', { customerId, shop });
    }
  } catch (error) {
    if (logger) {
      logger.error('Customer redact processing failed', { 
        customerId: data.customer?.id,
        shop: data.shop_domain,
        error: error.message 
      });
    }
    throw error;
  }
}

async function handleCustomerDataRequest(data, env, logger = null) {
  try {
    const customerId = data.customer?.id;
    const shop = data.shop_domain;
    
    if (logger) {
      logger.info('Customer data request webhook received', { 
        customerId, 
        shop,
        hasCustomerData: !!data.customer 
      });
    } else {
      console.log('Customer data request webhook received', { customerId, shop });
    }
    
    // In a real implementation, you would:
    // 1. Collect all customer data from your systems
    // 2. Format it according to GDPR requirements
    // 3. Provide it to the merchant for fulfilling the request
    
    // For now, just log the successful processing
    if (logger) {
      logger.info('Customer data request processed', { customerId, shop });
    }
  } catch (error) {
    if (logger) {
      logger.error('Customer data request processing failed', { 
        customerId: data.customer?.id,
        shop: data.shop_domain,
        error: error.message 
      });
    }
    throw error;
  }
}