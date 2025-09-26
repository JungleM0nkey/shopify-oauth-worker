import { ConfigurationError } from './errors.js';
import { ERROR_MESSAGES } from './constants.js';

// Environment Validation
export function validateEnvironment(env) {
  const required = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPS', 'AUTH_STATES', 'API_KEYS'];
  const missing = [];
  
  for (const key of required) {
    if (!env[key]) {
      missing.push(key);
    }
  }
  
  if (missing.length > 0) {
    throw new ConfigurationError(`${ERROR_MESSAGES.MISSING_ENV}: ${missing.join(', ')}`);
  }
}

// Shop Domain Validation - enhanced
export function isValidShopDomain(shop) {
  if (!shop || typeof shop !== 'string') return false;
  
  // More strict validation
  const shopRegex = /^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/;
  const normalizedShop = shop.toLowerCase().trim();
  
  if (!shopRegex.test(normalizedShop)) return false;
  
  // Additional checks
  if (normalizedShop.includes('..') || normalizedShop.includes('--')) return false;
  if (normalizedShop.startsWith('-') || normalizedShop.includes('-.') || normalizedShop.includes('.-')) return false;
  
  return true;
}

// Embedded Context Validation
export function isValidEmbeddedContext(embedded, host, hmac) {
  return embedded === '1' && host && hmac;
}

// Host Parameter Validation
export function isValidHost(host, shop) {
  if (!host) return false;
  
  try {
    // Decode base64 host parameter (URL-safe base64)
    const decodedHost = atob(host.replace(/-/g, '+').replace(/_/g, '/'));
    
    // The host should be in format: "shop-domain.myshopify.com/admin"
    // Just check if it contains the shop domain
    const shopDomain = shop.replace('https://', '').replace('http://', '').split('/')[0];
    return decodedHost.includes(shopDomain);
  } catch (error) {
    console.error('Host validation error:', error);
    return false;
  }
}

// Check Installation Status
export async function checkInstallation(shop, env) {
  try {
    const data = await env.SHOPS.get(shop);
    return !!data;
  } catch (error) {
    console.error('Error checking installation:', error);
    return false;
  }
}

// Validate API Key format
export function isValidApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return false;
  
  // UUID v4 format validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(apiKey);
}

// Validate state parameter
export function isValidState(state) {
  if (!state || typeof state !== 'string') return false;
  
  // State should be a UUID or secure random string
  return state.length >= 16 && state.length <= 100 && /^[a-zA-Z0-9-_]+$/.test(state);
}

// Validate OAuth code
export function isValidOAuthCode(code) {
  if (!code || typeof code !== 'string') return false;
  
  // Shopify OAuth codes are typically alphanumeric
  return code.length >= 10 && code.length <= 200 && /^[a-zA-Z0-9]+$/.test(code);
}

// Validate webhook topic
export function isValidWebhookTopic(topic) {
  const allowedTopics = [
    'customers/redact',
    'shop/redact', 
    'customers/data_request'
  ];
  return allowedTopics.includes(topic);
}

// Validate request content type
export function isValidContentType(request, expectedType = 'application/json') {
  const contentType = request.headers.get('content-type');
  if (!contentType) return false;
  
  return contentType.toLowerCase().includes(expectedType.toLowerCase());
}

// Validate user agent (basic bot protection)
export function isValidUserAgent(request) {
  const userAgent = request.headers.get('user-agent');
  if (!userAgent) return false;
  
  // Block known bad bots and empty user agents
  const blockedPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /^$/,
    /python/i,
    /curl/i,
    /wget/i
  ];
  
  return !blockedPatterns.some(pattern => pattern.test(userAgent));
}