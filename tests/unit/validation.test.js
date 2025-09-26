/**
 * Unit tests for validation module
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { 
  validateEnvironment, 
  isValidShopDomain, 
  isValidEmbeddedContext,
  isValidHost,
  checkInstallation
} from '../../lib/validation.js';
import { ConfigurationError } from '../../lib/errors.js';
import { createMockEnv, createMockKV } from '../utils/mocks.js';

describe('validation', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  describe('validateEnvironment', () => {
    it('should pass with all required environment variables', () => {
      expect(() => validateEnvironment(mockEnv)).not.toThrow();
    });

    it('should throw ConfigurationError when missing SHOPIFY_API_KEY', () => {
      delete mockEnv.SHOPIFY_API_KEY;
      expect(() => validateEnvironment(mockEnv))
        .toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when missing SHOPIFY_API_SECRET', () => {
      delete mockEnv.SHOPIFY_API_SECRET;
      expect(() => validateEnvironment(mockEnv))
        .toThrow(ConfigurationError);
    });

    it('should throw ConfigurationError when missing KV namespaces', () => {
      delete mockEnv.SHOPS;
      expect(() => validateEnvironment(mockEnv))
        .toThrow(ConfigurationError);
    });

    it('should include all missing variables in error message', () => {
      const incompleteEnv = {
        SHOPIFY_API_KEY: 'test'
        // Missing everything else
      };
      
      expect(() => validateEnvironment(incompleteEnv))
        .toThrow(/SHOPIFY_API_SECRET.*SHOPS.*AUTH_STATES.*API_KEYS/);
    });
  });

  describe('isValidShopDomain', () => {
    it('should return true for valid shop domains', () => {
      expect(isValidShopDomain('test-shop.myshopify.com')).toBe(true);
      expect(isValidShopDomain('shop123.myshopify.com')).toBe(true);
      expect(isValidShopDomain('my-awesome-shop.myshopify.com')).toBe(true);
    });

    it('should return false for invalid shop domains', () => {
      expect(isValidShopDomain('')).toBe(false);
      expect(isValidShopDomain(null)).toBe(false);
      expect(isValidShopDomain(undefined)).toBe(false);
      expect(isValidShopDomain('invalid-domain.com')).toBe(false);
      expect(isValidShopDomain('shop.shopify.com')).toBe(false);
      expect(isValidShopDomain('.myshopify.com')).toBe(false);
      expect(isValidShopDomain('shop..myshopify.com')).toBe(false);
      expect(isValidShopDomain('-shop.myshopify.com')).toBe(false);
    });
  });

  describe('isValidEmbeddedContext', () => {
    it('should return true when all parameters are present', () => {
      expect(isValidEmbeddedContext('1', 'encoded-host', 'hmac-value')).toBe(true);
    });

    it('should return false when embedded is not "1"', () => {
      expect(isValidEmbeddedContext('0', 'host', 'hmac')).toBe(false);
      expect(isValidEmbeddedContext('true', 'host', 'hmac')).toBe(false);
    });

    it('should return false when host is missing', () => {
      expect(isValidEmbeddedContext('1', '', 'hmac')).toBe(false);
      expect(isValidEmbeddedContext('1', null, 'hmac')).toBe(false);
    });

    it('should return false when hmac is missing', () => {
      expect(isValidEmbeddedContext('1', 'host', '')).toBe(false);
      expect(isValidEmbeddedContext('1', 'host', null)).toBe(false);
    });
  });

  describe('isValidHost', () => {
    it('should return true for valid encoded host matching shop', () => {
      // Base64 encode 'test-shop.myshopify.com/admin'
      const encodedHost = btoa('test-shop.myshopify.com/admin');
      expect(isValidHost(encodedHost, 'test-shop.myshopify.com')).toBe(true);
    });

    it('should return false for invalid host parameter', () => {
      expect(isValidHost('', 'test-shop.myshopify.com')).toBe(false);
      expect(isValidHost(null, 'test-shop.myshopify.com')).toBe(false);
    });

    it('should return false when host does not match shop', () => {
      const encodedHost = btoa('other-shop.myshopify.com/admin');
      expect(isValidHost(encodedHost, 'test-shop.myshopify.com')).toBe(false);
    });

    it('should handle URL-safe base64 encoding', () => {
      const host = 'test-shop.myshopify.com/admin';
      const urlSafeEncoded = btoa(host).replace(/\+/g, '-').replace(/\//g, '_');
      expect(isValidHost(urlSafeEncoded, 'test-shop.myshopify.com')).toBe(true);
    });
  });

  describe('checkInstallation', () => {
    it('should return true when shop data exists', async () => {
      const mockKV = createMockKV();
      await mockKV.put('test-shop.myshopify.com', JSON.stringify({
        accessToken: 'token',
        scope: 'read_products'
      }));
      
      const env = { SHOPS: mockKV };
      const result = await checkInstallation('test-shop.myshopify.com', env);
      expect(result).toBe(true);
    });

    it('should return false when shop data does not exist', async () => {
      const env = { SHOPS: createMockKV() };
      const result = await checkInstallation('non-existent-shop.myshopify.com', env);
      expect(result).toBe(false);
    });

    it('should return false when KV operation fails', async () => {
      const mockKV = createMockKV();
      mockKV.get.mockRejectedValue(new Error('KV error'));
      
      const env = { SHOPS: mockKV };
      const result = await checkInstallation('test-shop.myshopify.com', env);
      expect(result).toBe(false);
    });
  });
});