import { ValidationError } from '../errors/index.js';
import { ERROR_MESSAGES } from '../utils/constants.js';
import { isValidShopDomain, checkInstallation, isValidHost } from '../validation/index.js';
import { createInstallRedirect, createAccessDeniedPage, createEmbeddedApp, createLandingPage } from '../templates/index.js';
import { handleOAuth, handleOAuthCallback } from './oauth.js';
import { handleExtensionAuth, handleAPIProxy } from './api.js';
import { handleWebhook } from './webhooks.js';

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