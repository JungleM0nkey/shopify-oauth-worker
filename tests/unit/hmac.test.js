/**
 * Unit tests for HMAC verification module
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  timingSafeEqual, 
  verifyShopifyHmac, 
  verifyWebhookHmac 
} from '../../lib/hmac.js';
import { setupGlobalMocks } from '../utils/mocks.js';

describe('hmac', () => {
  beforeEach(() => {
    setupGlobalMocks();
  });

  describe('timingSafeEqual', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqual('hello', 'hello')).toBe(true);
      expect(timingSafeEqual('test123', 'test123')).toBe(true);
      expect(timingSafeEqual('', '')).toBe(true);
    });

    it('should return false for different strings', () => {
      expect(timingSafeEqual('hello', 'world')).toBe(false);
      expect(timingSafeEqual('test', 'TEST')).toBe(false);
      expect(timingSafeEqual('short', 'longer')).toBe(false);
    });

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqual('a', 'ab')).toBe(false);
      expect(timingSafeEqual('long string', 'short')).toBe(false);
    });

    it('should handle special characters', () => {
      expect(timingSafeEqual('!@#$%', '!@#$%')).toBe(true);
      expect(timingSafeEqual('üñíçøðé', 'üñíçøðé')).toBe(true);
      expect(timingSafeEqual('!@#$%', '!@#$&')).toBe(false);
    });
  });

  describe('verifyShopifyHmac', () => {
    const mockSecret = 'test-secret-key';

    it('should verify valid HMAC signature', async () => {
      const params = new URLSearchParams({
        code: 'auth-code-123',
        shop: 'test-shop.myshopify.com',
        state: 'random-state',
        timestamp: '1640995200',
        hmac: 'abcdef1234567890' // Mock hex HMAC
      });

      // Mock crypto operations to simulate successful verification
      const mockSignature = new Uint8Array([171, 205, 239, 18, 52, 86, 120, 144, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      global.crypto.subtle.sign = vi.fn().mockResolvedValue(mockSignature.buffer);

      const result = await verifyShopifyHmac(params, mockSecret);
      expect(result).toBe(true);
    });

    it('should reject invalid HMAC signature', async () => {
      const params = new URLSearchParams({
        code: 'auth-code-123',
        shop: 'test-shop.myshopify.com',
        state: 'random-state',
        timestamp: '1640995200',
        hmac: 'invalid-hmac-signature'  
      });

      // Mock crypto operations to simulate different signature
      const mockSignature = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      global.crypto.subtle.sign = vi.fn().mockResolvedValue(mockSignature.buffer);

      const result = await verifyShopifyHmac(params, mockSecret);
      expect(result).toBe(false);
    });

    it('should return false when HMAC parameter is missing', async () => {
      const params = new URLSearchParams({
        code: 'auth-code-123',
        shop: 'test-shop.myshopify.com',
        state: 'random-state'
        // hmac is missing
      });

      const result = await verifyShopifyHmac(params, mockSecret);
      expect(result).toBe(false);
    });

    it('should exclude hmac and signature from verification', async () => {
      const params = new URLSearchParams({
        code: 'auth-code-123',
        shop: 'test-shop.myshopify.com',
        hmac: 'abcdef1234567890',
        signature: 'test-signature'
      });

      // Mock crypto to simulate successful verification
      const mockSignature = new Uint8Array([171, 205, 239, 18, 52, 86, 120, 144, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      global.crypto.subtle.sign = vi.fn().mockResolvedValue(mockSignature.buffer);

      await verifyShopifyHmac(params, mockSecret);
      
      // Verify that the sign function was called (hmac and signature should be excluded from message)
      expect(global.crypto.subtle.sign).toHaveBeenCalled();
      const signCall = global.crypto.subtle.sign.mock.calls[0];
      const messageData = new TextDecoder().decode(signCall[2]);
      expect(messageData).not.toContain('hmac');
      expect(messageData).not.toContain('signature');
      expect(messageData).toContain('code=auth-code-123');
      expect(messageData).toContain('shop=test-shop.myshopify.com');
    });

    it('should handle crypto operation errors gracefully', async () => {
      const params = new URLSearchParams({
        code: 'auth-code-123',
        hmac: 'test-hmac'
      });

      global.crypto.subtle.importKey = vi.fn().mockRejectedValue(new Error('Crypto error'));

      const result = await verifyShopifyHmac(params, mockSecret);
      expect(result).toBe(false);
    });
  });

  describe('verifyWebhookHmac', () => {
    const mockSecret = 'webhook-secret';
    const mockBody = '{"id":123,"test":"data"}';

    it('should verify valid webhook HMAC', async () => {
      const mockHmac = 'mocked-base64-signature';
      
      // Mock successful HMAC verification
      const mockSignature = new ArrayBuffer(32);
      global.crypto.subtle.sign = vi.fn().mockResolvedValue(mockSignature);
      global.btoa = vi.fn().mockReturnValue('mocked-base64-signature');

      const result = await verifyWebhookHmac(mockBody, mockHmac, mockSecret);
      expect(result).toBe(true);
    });

    it('should reject webhook with invalid HMAC', async () => {
      const mockHmac = 'invalid-webhook-hmac';
      
      global.crypto.subtle.sign = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      global.btoa = vi.fn().mockReturnValue('different-signature');

      const result = await verifyWebhookHmac(mockBody, mockHmac, mockSecret);
      expect(result).toBe(false);
    });

    it('should return false for missing parameters', async () => {
      expect(await verifyWebhookHmac('', 'hmac', mockSecret)).toBe(false);
      expect(await verifyWebhookHmac(mockBody, '', mockSecret)).toBe(false);
      expect(await verifyWebhookHmac(mockBody, 'hmac', '')).toBe(false);
      expect(await verifyWebhookHmac(null, 'hmac', mockSecret)).toBe(false);
    });

    it('should handle crypto operation errors', async () => {
      const mockHmac = 'test-hmac';
      
      global.crypto.subtle.importKey = vi.fn().mockRejectedValue(new Error('Crypto error'));

      const result = await verifyWebhookHmac(mockBody, mockHmac, mockSecret);
      expect(result).toBe(false);
    });

    it('should use HMAC-SHA256 algorithm', async () => {
      const mockHmac = 'test-hmac';
      
      await verifyWebhookHmac(mockBody, mockHmac, mockSecret);
      
      expect(global.crypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(Uint8Array),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
    });
  });
});