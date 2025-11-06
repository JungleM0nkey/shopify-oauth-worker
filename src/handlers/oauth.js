import { AuthenticationError, ValidationError, ConfigurationError } from '../errors/index.js';
import { ERROR_MESSAGES, STATE_TTL_SECONDS } from '../utils/constants.js';
import { isValidShopDomain } from '../validation/index.js';
import { verifyShopifyHmac } from '../utils/hmac.js';
import { buildShopifyAuthUrl } from '../utils/index.js';
import { exchangeCodeForToken, storeShopData, registerMandatoryWebhooks } from '../shopify/api.js';

// Handle OAuth Initiation
export async function handleOAuth(request, env) {
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

  const authUrl = buildShopifyAuthUrl(
    shop,
    env.SHOPIFY_API_KEY,
    env.OAUTH_SCOPES,
    redirectUri,
    state,
  );
  return Response.redirect(authUrl, 302);
}

// Handle OAuth Callback
export async function handleOAuthCallback(request, env) {
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
