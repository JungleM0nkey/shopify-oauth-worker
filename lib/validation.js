/**
 * Validation utilities for input sanitization and security
 * @module validation
 */

import { ConfigurationError } from './errors.js';
import { ERROR_MESSAGES } from './constants.js';

/**
 * Validates that all required environment variables are present
 * @param {Object} env - Environment object from Cloudflare Workers
 * @throws {ConfigurationError} When required variables are missing
 */
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

/**
 * Validates Shopify shop domain format
 * @param {string} shop - Shop domain to validate
 * @returns {boolean} True if valid .myshopify.com domain
 * @example
 * isValidShopDomain('example.myshopify.com') // returns true
 * isValidShopDomain('invalid.com') // returns false
 */
export function isValidShopDomain(shop) {
  if (!shop) {
    return false;
  }
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}

/**
 * Validates embedded app context parameters
 * @param {string} embedded - Should be '1' for embedded context
 * @param {string} host - Base64 encoded host parameter
 * @param {string} hmac - HMAC signature for verification
 * @returns {boolean} True if all parameters are valid for embedded context
 */
export function isValidEmbeddedContext(embedded, host, hmac) {
  return embedded === '1' && !!host && !!hmac;
}

/**
 * Validates host parameter matches shop domain
 * @param {string} host - Base64 encoded host parameter from Shopify
 * @param {string} shop - Shop domain to verify against
 * @returns {boolean} True if host parameter contains the shop domain
 */
/**
 * Validates host parameter matches shop domain
 * @param {string} host - Base64 encoded host parameter from Shopify
 * @param {string} shop - Shop domain to verify against
 * @returns {boolean} True if host parameter contains the shop domain
 */
export function isValidHost(host, shop) {
  if (!host) {
    return false;
  }
  
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

/**
 * Checks if a shop has been installed (has data in KV storage)
 * @param {string} shop - Shop domain to check
 * @param {Object} env - Environment object with KV bindings
 * @returns {Promise<boolean>} True if shop data exists in storage
 */
export async function checkInstallation(shop, env) {
  try {
    const data = await env.SHOPS.get(shop);
    return !!data;
  } catch (error) {
    console.error('Error checking installation:', error);
    return false;
  }
}