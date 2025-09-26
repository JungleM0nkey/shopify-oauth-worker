// Application Constants
export const APP_NAME = 'Storefront OAuth Gateway';
export const STATE_TTL_SECONDS = 600;
export const API_KEY_TTL_DAYS = 90;

// Security Configuration
export const SECURITY_CONFIG = {
  CORS_MAX_AGE: 86400, // 24 hours
  RATE_LIMIT_WINDOW: 60, // 1 minute
  RATE_LIMIT_MAX_REQUESTS: 100,
  CSP_POLICY: "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.shopify.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.myshopify.com; frame-ancestors https://*.myshopify.com https://admin.shopify.com;",
};

// Error Messages
export const ERROR_MESSAGES = {
  MISSING_ENV: 'Missing required environment variables',
  INVALID_SHOP: 'Invalid shop domain',
  INVALID_HOST: 'Invalid host parameter',
  INVALID_HMAC: 'Invalid HMAC signature',
  INVALID_STATE: 'Invalid state parameter',
  INVALID_WEBHOOK: 'Invalid webhook signature',
  APP_NOT_INSTALLED: 'App not installed',
  MISSING_AUTH: 'Missing or invalid authorization',
  INVALID_API_KEY: 'Invalid API key',
  MISSING_ENDPOINT: 'Missing endpoint parameter',
  MISSING_OAUTH_PARAMS: 'Missing required OAuth parameters',
  FAILED_TOKEN_EXCHANGE: 'Failed to exchange code for token',
  FAILED_PROXY: 'Failed to proxy request',
  FAILED_AUTH_INIT: 'Failed to initialize authentication',
  ACCESS_DENIED_TITLE: 'Access Denied',
  ACCESS_DENIED_MESSAGE: 'This app can only be accessed from within the Shopify admin dashboard.',
};