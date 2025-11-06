import { ValidationError } from '../errors/index.js';
import { ERROR_MESSAGES } from '../utils/constants.js';
import { isValidShopDomain, checkInstallation, isValidHost } from '../validation/index.js';
import {
  createInstallRedirect,
  createAccessDeniedPage,
  createEmbeddedApp,
  createLandingPage,
} from '../templates/index.js';
import { handleOAuth, handleOAuthCallback } from './oauth.js';
import { handleExtensionAuth, handleAPIProxy } from './api.js';
import { handleWebhook } from './webhooks.js';
import { handleHealthCheck } from './health.js';

// Request Router
export async function routeRequest(request, url, env, corsHeaders, logger) {
  // Handle root path
  if (url.pathname === '/') {
    return handleRootPath(url, env, logger);
  }

  // Handle specific routes
  const routes = {
    '/health': () => handleHealthCheck(env, logger),
    '/auth': () => handleOAuth(request, env, logger),
    '/auth/callback': () => handleOAuthCallback(request, env, logger),
    '/webhooks/customers/redact': () => handleWebhook(request, env, 'customers/redact', logger),
    '/webhooks/shop/redact': () => handleWebhook(request, env, 'shop/redact', logger),
    '/webhooks/customers/data_request': () =>
      handleWebhook(request, env, 'customers/data_request', logger),
    '/api/auth': () => handleExtensionAuth(request, env, corsHeaders, logger),
    '/api/proxy': () => handleAPIProxy(request, env, corsHeaders, logger),
  };

  const handler = routes[url.pathname];
  if (handler) {
    return await handler();
  }

  return new Response('Not Found', { status: 404 });
}

// Root Path Handler
async function handleRootPath(url, env, logger) {
  const shop = url.searchParams.get('shop');
  const embedded = url.searchParams.get('embedded');
  const host = url.searchParams.get('host');

  // No shop parameter - show landing page
  if (!shop) {
    return createLandingPage();
  }

  // Validate shop domain
  if (!isValidShopDomain(shop)) {
    if (logger) {
      logger.warn('Invalid shop domain', { shop });
    }
    throw new ValidationError(ERROR_MESSAGES.INVALID_SHOP);
  }

  // Check installation status
  const isInstalled = await checkInstallation(shop, env);

  if (!isInstalled) {
    if (logger) {
      logger.info('App not installed, redirecting to install', { shop });
    }
    return createInstallRedirect(shop, env);
  }

  // Check if this is an embedded app request
  if (embedded === '1') {
    // For embedded apps, validate host parameter
    if (!host) {
      if (logger) {
        logger.error('Missing host parameter for embedded app', { shop });
      } else {
        console.error('Missing host parameter for embedded app');
      }
      return createAccessDeniedPage(shop);
    }

    // SECURITY FIX: Enforce host validation - do not proceed on failure
    if (!isValidHost(host, shop)) {
      if (logger) {
        logger.error('Host validation failed - access denied', {
          host: host ? `${host.substring(0, 20)}...` : 'null',
          shop,
        });
      } else {
        console.error('Host validation failed:', {
          host: host ? `${host.substring(0, 20)}...` : 'null',
          shop,
        });
      }
      // FIXED: Return error page instead of continuing
      return createAccessDeniedPage(shop);
    }

    if (logger) {
      logger.info('Serving embedded app', { shop });
    }
    return createEmbeddedApp(shop, host, env);
  }

  // Non-embedded access - redirect to Shopify admin
  if (logger) {
    logger.info('Redirecting to Shopify admin', { shop });
  }
  return Response.redirect(`https://${shop}/admin/apps/${env.SHOPIFY_APP_HANDLE}`, 302);
}
