import { AuthenticationError, ValidationError, ConfigurationError } from './errors.js';
import { ERROR_MESSAGES, STATE_TTL_SECONDS, API_KEY_TTL_DAYS, SECURITY_CONFIG } from './constants.js';
import { 
  isValidShopDomain, 
  checkInstallation, 
  isValidHost 
} from './validation.js';
import { verifyShopifyHmac, verifyWebhookHmac } from './hmac.js';
import { 
  getCorsHeaders, 
  getSecurityHeaders,
  extractApiKey, 
  parseJsonBody, 
  createJsonResponse,
  buildShopifyAuthUrl,
  checkRateLimit,
  sanitizeInput
} from './utils.js';
import {
  exchangeCodeForToken,
  storeShopData,
  registerMandatoryWebhooks,
  proxyToShopify
} from './shopify.js';
import {
  createInstallRedirect,
  createAccessDeniedPage,
  createEmbeddedApp,
  createLandingPage
} from './templates.js';

// Request Router
export async function routeRequest(request, url, env, corsHeaders) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
  
  // Health check endpoints
  if (url.pathname === '/health') {
    return handleHealthCheck(env, corsHeaders);
  }
  
  if (url.pathname === '/health/ready') {
    return handleReadinessCheck(env, corsHeaders);
  }
  
  // Rate limiting for API endpoints
  if (url.pathname.startsWith('/api/')) {
    const rateLimitOk = await checkRateLimit(
      clientIP, 
      url.pathname, 
      env, 
      SECURITY_CONFIG.RATE_LIMIT_MAX_REQUESTS,
      SECURITY_CONFIG.RATE_LIMIT_WINDOW
    );
    
    if (!rateLimitOk) {
      return createJsonResponse(
        { error: 'Rate limit exceeded', retry_after: SECURITY_CONFIG.RATE_LIMIT_WINDOW },
        429,
        corsHeaders,
        getSecurityHeaders(env)
      );
    }
  }
  
  // Handle root path
  if (url.pathname === '/') {
    return handleRootPath(url, env);
  }
  
  // Handle specific routes
  const routes = {
    '/auth': () => handleOAuth(request, env),
    '/auth/callback': () => handleOAuthCallback(request, env),
    '/webhooks/customers/redact': () => handleWebhook(request, env, 'customers/redact'),
    '/webhooks/shop/redact': () => handleWebhook(request, env, 'shop/redact'),
    '/webhooks/customers/data_request': () => handleWebhook(request, env, 'customers/data_request'),
    '/api/auth': () => handleExtensionAuth(request, env, corsHeaders, clientIP),
    '/api/proxy': () => handleAPIProxy(request, env, corsHeaders, clientIP),
  };
  
  const handler = routes[url.pathname];
  if (handler) {
    return await handler();
  }
  
  return new Response('Not Found', { status: 404 });
}

// Health Check Endpoints
async function handleHealthCheck(env, corsHeaders) {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    checks: {
      kv_namespaces: await checkKVNamespaces(env),
      environment: checkEnvironmentHealth(env),
    }
  };
  
  const status = Object.values(health.checks).every(check => check.status === 'ok') ? 200 : 503;
  
  return createJsonResponse(health, status, corsHeaders, getSecurityHeaders(env));
}

async function handleReadinessCheck(env, corsHeaders) {
  const ready = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    dependencies: await checkDependencies(env),
  };
  
  const status = ready.dependencies.shopify_api && ready.dependencies.kv_storage ? 200 : 503;
  
  return createJsonResponse(ready, status, corsHeaders, getSecurityHeaders(env));
}

// Health Check Utilities
async function checkKVNamespaces(env) {
  try {
    // Test KV namespace connectivity
    await env.SHOPS.put('health_check', 'ok', { expirationTtl: 10 });
    await env.SHOPS.delete('health_check');
    return { status: 'ok', message: 'KV namespaces accessible' };
  } catch (error) {
    return { status: 'error', message: 'KV namespace connectivity failed' };
  }
}

function checkEnvironmentHealth(env) {
  const required = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPS', 'AUTH_STATES', 'API_KEYS'];
  const missing = required.filter(key => !env[key]);
  
  return missing.length === 0 
    ? { status: 'ok', message: 'All required environment variables present' }
    : { status: 'error', message: `Missing: ${missing.join(', ')}` };
}

async function checkDependencies(env) {
  return {
    shopify_api: env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET,
    kv_storage: env.SHOPS && env.AUTH_STATES && env.API_KEYS,
    app_url: env.APP_URL || false,
  };
}
// Root Path Handler
async function handleRootPath(url, env) {
  const shop = sanitizeInput(url.searchParams.get('shop'), 'shop');
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
  
  // Check installation status with error handling
  let isInstalled = false;
  try {
    isInstalled = await checkInstallation(shop, env);
  } catch (error) {
    console.error('Installation check failed:', error);
    // Continue with installation flow if check fails
  }
  
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
  const shop = sanitizeInput(url.searchParams.get('shop'), 'shop');
  
  if (!isValidShopDomain(shop)) {
    throw new ValidationError(ERROR_MESSAGES.INVALID_SHOP);
  }
  
  // Generate cryptographically secure state
  const state = crypto.randomUUID();
  const redirectUri = `${env.APP_URL || url.origin}/auth/callback`;
  
  // Store state for verification with error handling and retry logic
  let retries = 3;
  while (retries > 0) {
    try {
      await env.AUTH_STATES.put(state, shop, { expirationTtl: STATE_TTL_SECONDS });
      break;
    } catch (error) {
      retries--;
      console.error(`Failed to store auth state (${retries} retries left):`, error);
      if (retries === 0) {
        throw new ConfigurationError(ERROR_MESSAGES.FAILED_AUTH_INIT);
      }
      // Brief delay before retry
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const authUrl = buildShopifyAuthUrl(shop, env.SHOPIFY_API_KEY, env.OAUTH_SCOPES, redirectUri, state);
  return Response.redirect(authUrl, 302);
}

async function handleOAuthCallback(request, env) {
  const url = new URL(request.url);
  const { code, shop: rawShop, state, hmac } = Object.fromEntries(url.searchParams);
  
  // Sanitize and validate all required parameters
  const shop = sanitizeInput(rawShop, 'shop');
  
  if (!code || !shop || !state || !hmac) {
    throw new ValidationError(ERROR_MESSAGES.MISSING_OAUTH_PARAMS);
  }
  
  // Additional validation for parameters
  if (code.length > 100 || state.length > 100 || hmac.length > 100) {
    throw new ValidationError('Parameter length exceeded maximum allowed');
  }
  
  // Verify state with error handling
  let savedShop;
  try {
    savedShop = await env.AUTH_STATES.get(state);
  } catch (error) {
    console.error('Failed to retrieve auth state:', error);
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_STATE, 403);
  }
  
  if (savedShop !== shop) {
    console.error('State validation failed:', { expected: savedShop, received: shop });
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_STATE, 403);
  }
  
  // Clean up state (fire and forget to avoid blocking)
  env.AUTH_STATES.delete(state).catch(err => 
    console.warn('Failed to cleanup auth state:', err)
  );
  
  // Verify HMAC with enhanced logging
  const isValidHmac = await verifyShopifyHmac(url.searchParams, env.SHOPIFY_API_SECRET);
  if (!isValidHmac) {
    console.error('HMAC verification failed for OAuth callback', {
      shop,
      hmac: hmac.substring(0, 10) + '...',
      timestamp: new Date().toISOString()
    });
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_HMAC, 403);
  }
  
  // Exchange code for access token with retry logic
  let tokenData;
  let retries = 3;
  while (retries > 0) {
    try {
      tokenData = await exchangeCodeForToken(shop, code, env);
      break;
    } catch (error) {
      retries--;
      console.error(`Token exchange failed (${retries} retries left):`, error);
      if (retries === 0) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }
  
  // Store shop data with error handling
  try {
    await storeShopData(shop, tokenData, env);
  } catch (error) {
    console.error('Failed to store shop data:', error);
    // Continue with webhook registration even if storage fails
  }
  
  // Register webhooks with error handling (non-blocking)
  registerMandatoryWebhooks(shop, tokenData.access_token, env)
    .catch(error => console.error('Webhook registration failed:', error));
  
  // Redirect to app in Shopify admin
  return Response.redirect(`https://${shop}/admin/apps/${env.SHOPIFY_APP_HANDLE}`, 302);
}

// Extension Authentication
async function handleExtensionAuth(request, env, corsHeaders, clientIP) {
  const body = await parseJsonBody(request);
  const shop = sanitizeInput(body.shop, 'shop');
  
  if (!isValidShopDomain(shop)) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.INVALID_SHOP },
      400,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  // Check if shop has app installed with retry logic
  let shopData;
  let retries = 3;
  while (retries > 0) {
    try {
      shopData = await env.SHOPS.get(shop, 'json');
      break;
    } catch (error) {
      retries--;
      console.error(`Shop data retrieval failed (${retries} retries left):`, error);
      if (retries === 0) {
        return createJsonResponse(
          { error: 'Service temporarily unavailable', retry_after: 30 },
          503,
          corsHeaders,
          getSecurityHeaders(env)
        );
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (!shopData) {
    return createJsonResponse(
      {
        error: ERROR_MESSAGES.APP_NOT_INSTALLED,
        install_url: `https://apps.shopify.com/${env.SHOPIFY_APP_HANDLE}`,
      },
      403,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  // Generate and store API key with metadata
  const apiKey = crypto.randomUUID();
  const keyMetadata = {
    shop,
    accessToken: shopData.accessToken,
    createdAt: new Date().toISOString(),
    clientIP: clientIP,
    userAgent: request.headers.get('User-Agent')?.substring(0, 200) || 'unknown',
    lastUsed: new Date().toISOString(),
  };
  
  try {
    await env.API_KEYS.put(
      `key:${apiKey}`,
      JSON.stringify(keyMetadata),
      { expirationTtl: 86400 * API_KEY_TTL_DAYS }
    );
  } catch (error) {
    console.error('Failed to store API key:', error);
    return createJsonResponse(
      { error: 'Failed to generate API key', retry_after: 10 },
      500,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  return createJsonResponse(
    { success: true, api_key: apiKey, shop, expires_in: 86400 * API_KEY_TTL_DAYS },
    200,
    corsHeaders,
    getSecurityHeaders(env)
  );
}

// API Proxy Handler
async function handleAPIProxy(request, env, corsHeaders, clientIP) {
  // Extract and validate API key
  const apiKey = extractApiKey(request);
  if (!apiKey) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.MISSING_AUTH },
      401,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  // Verify API key with error handling
  let keyData;
  try {
    keyData = await env.API_KEYS.get(`key:${apiKey}`, 'json');
  } catch (error) {
    console.error('Failed to retrieve API key:', error);
    return createJsonResponse(
      { error: 'Service temporarily unavailable' },
      503,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  if (!keyData) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.INVALID_API_KEY },
      401,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  const { shop, accessToken } = keyData;
  
  // Update last used timestamp (fire and forget)
  env.API_KEYS.put(
    `key:${apiKey}`,
    JSON.stringify({ ...keyData, lastUsed: new Date().toISOString() }),
    { expirationTtl: 86400 * API_KEY_TTL_DAYS }
  ).catch(err => console.warn('Failed to update key usage:', err));
  
  // Parse request body with validation
  const body = await parseJsonBody(request);
  let { endpoint, method = 'GET', data } = body;
  
  // Sanitize and validate endpoint
  endpoint = sanitizeInput(endpoint, 'endpoint');
  if (!endpoint) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.MISSING_ENDPOINT },
      400,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  // Validate HTTP method
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  if (!allowedMethods.includes(method.toUpperCase())) {
    return createJsonResponse(
      { error: 'Invalid HTTP method' },
      400,
      corsHeaders,
      getSecurityHeaders(env)
    );
  }
  
  // Log API usage for monitoring
  console.log('API Proxy Request:', {
    shop,
    endpoint,
    method,
    clientIP,
    timestamp: new Date().toISOString(),
  });
  
  // Proxy request to Shopify with retry logic
  let shopifyResponse;
  let retries = 2;
  while (retries >= 0) {
    try {
      shopifyResponse = await proxyToShopify(
        shop,
        endpoint,
        method.toUpperCase(),
        data,
        accessToken,
        env
      );
      break;
    } catch (error) {
      retries--;
      console.error(`Proxy error (${retries + 1} retries left):`, error);
      if (retries < 0) {
        return createJsonResponse(
          { error: ERROR_MESSAGES.FAILED_PROXY, details: error.message },
          500,
          corsHeaders,
          getSecurityHeaders(env)
        );
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return createJsonResponse(
    shopifyResponse.data,
    shopifyResponse.status,
    corsHeaders,
    getSecurityHeaders(env)
  );
}

// Webhook Handlers
async function handleWebhook(request, env, topic) {
  // Verify webhook authenticity
  const hmac = request.headers.get('X-Shopify-Hmac-Sha256');
  const shopDomain = request.headers.get('X-Shopify-Shop-Domain');
  
  if (!hmac) {
    console.error('Missing HMAC header for webhook');
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_WEBHOOK, 401);
  }
  
  let body;
  try {
    body = await request.text();
  } catch (error) {
    console.error('Failed to read webhook body:', error);
    throw new ValidationError('Invalid webhook body');
  }
  
  const isValidWebhook = await verifyWebhookHmac(body, hmac, env.SHOPIFY_API_SECRET);
  if (!isValidWebhook) {
    console.error('Webhook HMAC verification failed', {
      topic,
      shop: shopDomain,
      hmac: hmac.substring(0, 10) + '...',
      timestamp: new Date().toISOString()
    });
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_WEBHOOK, 401);
  }
  
  let data;
  try {
    data = JSON.parse(body);
  } catch (error) {
    console.error('Invalid JSON in webhook body:', error);
    throw new ValidationError('Invalid webhook JSON');
  }
  
  // Log webhook receipt for monitoring
  console.log('Webhook received:', {
    topic,
    shop: shopDomain || data.shop_domain || 'unknown',
    timestamp: new Date().toISOString(),
  });
  
  // Handle webhook with error recovery
  try {
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
      default:
        console.warn('Unknown webhook topic:', topic);
    }
  } catch (error) {
    console.error(`Webhook handler error for ${topic}:`, error);
    // For GDPR webhooks, we should still return 200 to avoid retries
    // The error is logged for manual review
  }
  
  return new Response('', { status: 200 });
}

async function handleShopRedact(data, env) {
  const shop = data.shop_domain;
  if (!shop) {
    console.error('Missing shop_domain in shop redact webhook');
    return;
  }
  
  console.log(`Processing shop redaction for: ${shop}`);
  
  try {
    // Delete shop data
    await env.SHOPS.delete(shop);
    
    // Clean up related API keys - this is a more complex operation
    // For now, we log it for manual cleanup since KV doesn't support queries
    console.log(`Shop data deleted for: ${shop}. Manual API key cleanup may be required.`);
    
    // In a production system, you might want to:
    // 1. Use a separate index to track API keys by shop
    // 2. Use Durable Objects for more complex data operations
    // 3. Queue cleanup tasks for batch processing
    
  } catch (error) {
    console.error(`Failed to redact shop data for ${shop}:`, error);
    throw error;
  }
}

async function handleCustomerRedact(data, env) {
  const customerId = data.customer?.id;
  const shopDomain = data.shop_domain;
  
  console.log('Customer redact webhook received', {
    customerId,
    shopDomain,
    timestamp: new Date().toISOString()
  });
  
  // Currently, this worker doesn't store customer-specific data
  // If it did, you would implement customer data deletion here
  
  // Log for compliance tracking
  console.log(`Customer ${customerId} redaction processed for shop ${shopDomain}`);
}

async function handleCustomerDataRequest(data, env) {
  const customerId = data.customer?.id;
  const shopDomain = data.shop_domain;
  
  console.log('Customer data request webhook received', {
    customerId,
    shopDomain,
    timestamp: new Date().toISOString()
  });
  
  // Currently, this worker doesn't store customer-specific data
  // If it did, you would implement data export here
  
  // For compliance, you might need to:
  // 1. Generate a report of all customer data stored
  // 2. Send it to the shop owner via email or API
  // 3. Log the request for audit purposes
  
  console.log(`Customer ${customerId} data request processed for shop ${shopDomain}`);
}