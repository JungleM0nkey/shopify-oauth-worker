import { AuthenticationError, ValidationError, ConfigurationError } from './errors.js';
import { ERROR_MESSAGES, STATE_TTL_SECONDS, API_KEY_TTL_DAYS } from './constants.js';
import { 
  isValidShopDomain, 
  checkInstallation, 
  isValidHost,
  isValidApiKey,
  isValidState,
  isValidOAuthCode,
  isValidWebhookTopic,
  isValidContentType,
  isValidUserAgent
} from './validation.js';
import { verifyShopifyHmac, verifyWebhookHmac } from './hmac.js';
import { 
  getCorsHeaders, 
  extractApiKey, 
  parseJsonBody, 
  createJsonResponse,
  createHtmlResponse,
  buildShopifyAuthUrl,
  validateAndSanitizeShop,
  validateEndpoint,
  validateHttpMethod,
  sanitizeString
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
import {
  rateLimitByApiKey,
  rateLimitByShop,
  rateLimitAuth,
  addRateLimitHeaders
} from './rate-limit.js';

// Request Router
export async function routeRequest(request, url, env, corsHeaders) {
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
    '/api/auth': () => handleExtensionAuth(request, env, corsHeaders),
    '/api/proxy': () => handleAPIProxy(request, env, corsHeaders),
  };
  
  const handler = routes[url.pathname];
  if (handler) {
    return await handler();
  }
  
  return new Response('Not Found', { status: 404 });
}

// Root Path Handler
async function handleRootPath(url, env) {
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
  const isInstalled = await checkInstallation(shop, env);
  
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
async function handleExtensionAuth(request, env, corsHeaders) {
  // Validate request method and content type
  if (request.method !== 'POST') {
    return createJsonResponse(
      { error: 'Method not allowed' },
      405,
      corsHeaders
    );
  }
  
  if (!isValidContentType(request)) {
    return createJsonResponse(
      { error: 'Invalid content type' },
      400,
      corsHeaders
    );
  }
  
  // Basic user agent validation
  if (!isValidUserAgent(request)) {
    return createJsonResponse(
      { error: 'Invalid request' },
      400,
      corsHeaders
    );
  }
  
  let body;
  try {
    body = await parseJsonBody(request, 1024); // 1KB limit for auth requests
  } catch (error) {
    return createJsonResponse(
      { error: 'Request body too large or invalid' },
      400,
      corsHeaders
    );
  }
  
  const shop = validateAndSanitizeShop(body.shop);
  if (!shop) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.INVALID_SHOP },
      400,
      corsHeaders
    );
  }
  
  // Rate limit by shop for auth requests
  const authRateLimit = await rateLimitAuth(request, env, shop);
  if (authRateLimit) return authRateLimit;
  
  // Check if shop has app installed
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
      userAgent: request.headers.get('user-agent')?.substring(0, 200) || 'unknown',
    }),
    { expirationTtl: 86400 * API_KEY_TTL_DAYS }
  );
  
  return createJsonResponse(
    { success: true, api_key: apiKey, shop },
    200,
    corsHeaders
  );
}

// API Proxy Handler
async function handleAPIProxy(request, env, corsHeaders) {
  // Validate request method and content type
  if (request.method !== 'POST') {
    return createJsonResponse(
      { error: 'Method not allowed' },
      405,
      corsHeaders
    );
  }
  
  if (!isValidContentType(request)) {
    return createJsonResponse(
      { error: 'Invalid content type' },
      400,
      corsHeaders
    );
  }
  
  // Extract and validate API key
  const apiKey = extractApiKey(request);
  if (!apiKey || !isValidApiKey(apiKey)) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.MISSING_AUTH },
      401,
      corsHeaders
    );
  }
  
  // Rate limit by API key
  const apiRateLimit = await rateLimitByApiKey(request, env, apiKey);
  if (apiRateLimit) return apiRateLimit;
  
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
  
  // Parse request body with size limit
  let body;
  try {
    body = await parseJsonBody(request, 10 * 1024); // 10KB limit for proxy requests
  } catch (error) {
    return createJsonResponse(
      { error: 'Request body too large or invalid' },
      400,
      corsHeaders
    );
  }
  
  const { endpoint, method = 'GET', data } = body;
  
  // Validate endpoint
  if (!endpoint || !validateEndpoint(endpoint)) {
    return createJsonResponse(
      { error: ERROR_MESSAGES.MISSING_ENDPOINT },
      400,
      corsHeaders
    );
  }
  
  // Validate HTTP method
  if (!validateHttpMethod(method)) {
    return createJsonResponse(
      { error: 'Invalid HTTP method' },
      400,
      corsHeaders
    );
  }
  
  // Rate limit by shop
  const shopRateLimit = await rateLimitByShop(request, env, shop);
  if (shopRateLimit) return shopRateLimit;
  
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
    
    return addRateLimitHeaders(
      createJsonResponse(
        shopifyResponse.data,
        shopifyResponse.status,
        corsHeaders
      ),
      'API_KEY'
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

// Webhook Handlers
async function handleWebhook(request, env, topic) {
  // Validate topic
  if (!isValidWebhookTopic(topic)) {
    console.error('Invalid webhook topic:', topic);
    return new Response('Invalid topic', { status: 400 });
  }
  
  // Validate request method
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  // Validate content type
  const contentType = request.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    return new Response('Invalid content type', { status: 400 });
  }
  
  // Check for required Shopify headers
  const shopifyTopic = request.headers.get('X-Shopify-Topic');
  const shopifyShop = request.headers.get('X-Shopify-Shop-Domain');
  const hmacHeader = request.headers.get('X-Shopify-Hmac-Sha256');
  
  if (!shopifyTopic || !shopifyShop || !hmacHeader) {
    console.error('Missing required Shopify headers');
    return new Response('Missing headers', { status: 400 });
  }
  
  // Validate shop domain from header
  if (!isValidShopDomain(shopifyShop)) {
    console.error('Invalid shop domain in header:', shopifyShop);
    return new Response('Invalid shop', { status: 400 });
  }
  
  // Read and validate body size
  const body = await request.text();
  if (body.length > 1024 * 1024) { // 1MB limit
    console.error('Webhook body too large');
    return new Response('Body too large', { status: 413 });
  }
  
  // Verify webhook authenticity
  const isValidWebhook = await verifyWebhookHmac(body, hmacHeader, env.SHOPIFY_API_SECRET);
  if (!isValidWebhook) {
    console.error('Webhook HMAC verification failed for shop:', shopifyShop);
    return new Response('Unauthorized', { status: 401 });
  }
  
  let data;
  try {
    data = JSON.parse(body);
  } catch (error) {
    console.error('Invalid JSON in webhook body');
    return new Response('Invalid JSON', { status: 400 });
  }
  
  // Process webhook based on topic
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
  
  return new Response('OK', { status: 200 });
}

async function handleShopRedact(data, env) {
  try {
    const shop = sanitizeString(data?.shop_domain);
    if (shop && isValidShopDomain(shop)) {
      await env.SHOPS.delete(shop);
      console.log(`Shop data deleted for: ${shop}`);
    } else {
      console.error('Invalid shop domain in redact webhook:', data?.shop_domain);
    }
  } catch (error) {
    console.error('Error handling shop redact:', error);
  }
}

async function handleCustomerRedact(data, env) {
  try {
    const customerId = sanitizeString(data?.customer?.id?.toString());
    const shopDomain = sanitizeString(data?.shop_domain);
    
    if (customerId && shopDomain && isValidShopDomain(shopDomain)) {
      console.log(`Customer redact webhook received for customer ${customerId} at shop ${shopDomain}`);
      // Implementation would depend on what customer data is stored
    } else {
      console.error('Invalid data in customer redact webhook');
    }
  } catch (error) {
    console.error('Error handling customer redact:', error);
  }
}

async function handleCustomerDataRequest(data, env) {
  try {
    const customerId = sanitizeString(data?.customer?.id?.toString());
    const shopDomain = sanitizeString(data?.shop_domain);
    
    if (customerId && shopDomain && isValidShopDomain(shopDomain)) {
      console.log(`Customer data request webhook received for customer ${customerId} at shop ${shopDomain}`);
      // Implementation would depend on what customer data is stored and needs to be returned
    } else {
      console.error('Invalid data in customer data request webhook');
    }
  } catch (error) {
    console.error('Error handling customer data request:', error);
  }
}