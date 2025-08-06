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

// Shop Domain Validation
export function isValidShopDomain(shop) {
  if (!shop) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
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