// Tests for logger utility
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequestLogger, generateRequestId } from '../src/utils/logger.js';

describe('Logger Utility', () => {
  beforeEach(() => {
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('generateRequestId', () => {
    it('should generate a valid UUID', () => {
      const id = generateRequestId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate unique IDs', () => {
      const id1 = generateRequestId();
      const id2 = generateRequestId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('createRequestLogger', () => {
    it('should create logger with request context', () => {
      const requestId = 'test-request-id';
      const context = { method: 'GET', url: 'https://example.com' };

      const logger = createRequestLogger(requestId, context);

      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('debug');
    });

    it('should log with structured format', () => {
      const logger = createRequestLogger('test-id', { test: 'data' });

      logger.info('Test message', { additional: 'data' });

      expect(console.log).toHaveBeenCalled();
      const logCall = console.log.mock.calls[0][0];
      const logData = JSON.parse(logCall);

      expect(logData.level).toBe('INFO');
      expect(logData.message).toBe('Test message');
      expect(logData.requestId).toBe('test-id');
      expect(logData.test).toBe('data');
      expect(logData.additional).toBe('data');
    });

    it('should use correct console method for each level', () => {
      const logger = createRequestLogger('test-id');

      logger.error('Error message');
      expect(console.error).toHaveBeenCalled();

      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalled();

      logger.info('Info message');
      expect(console.log).toHaveBeenCalled();
    });
  });
});
