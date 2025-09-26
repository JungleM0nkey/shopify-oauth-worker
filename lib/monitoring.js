// Monitoring, Logging, and Error Tracking Module
// Provides structured logging, performance metrics, and error tracking

import { getCorsHeaders } from './utils.js';

// Request context for tracing
const requestContexts = new Map();

// Generate unique request ID
export function generateRequestId() {
  return crypto.randomUUID();
}

// Store request context for tracing
export function setRequestContext(requestId, context) {
  requestContexts.set(requestId, {
    ...context,
    timestamp: new Date().toISOString(),
  });
}

// Get request context
export function getRequestContext(requestId) {
  return requestContexts.get(requestId);
}

// Clean up old request contexts (prevent memory leaks)
export function cleanupRequestContexts() {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  for (const [requestId, context] of requestContexts.entries()) {
    const contextAge = now - new Date(context.timestamp).getTime();
    if (contextAge > maxAge) {
      requestContexts.delete(requestId);
    }
  }
}

// Structured logger class
export class StructuredLogger {
  constructor(requestId, context = {}) {
    this.requestId = requestId;
    this.context = context;
  }

  _log(level, message, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: this.requestId,
      context: this.context,
      ...data,
    };

    console.log(JSON.stringify(logEntry));
    return logEntry;
  }

  info(message, data = {}) {
    return this._log('info', message, data);
  }

  warn(message, data = {}) {
    return this._log('warn', message, data);
  }

  error(message, data = {}) {
    return this._log('error', message, data);
  }

  debug(message, data = {}) {
    return this._log('debug', message, data);
  }

  // Log performance metrics
  metric(name, value, unit = 'ms', tags = {}) {
    return this._log('metric', `${name}: ${value}${unit}`, {
      metric: {
        name,
        value,
        unit,
        tags,
      },
    });
  }
}

// Performance monitoring
export class PerformanceMonitor {
  constructor(logger) {
    this.logger = logger;
    this.startTime = Date.now();
    this.metrics = new Map();
  }

  // Start timing an operation
  startTimer(operation) {
    this.metrics.set(operation, Date.now());
  }

  // End timing and log metric
  endTimer(operation, tags = {}) {
    const startTime = this.metrics.get(operation);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.logger.metric(`${operation}_duration`, duration, 'ms', tags);
      this.metrics.delete(operation);
      return duration;
    }
    return null;
  }

  // Log request completion
  logRequestComplete(statusCode, error = null) {
    const totalDuration = Date.now() - this.startTime;
    this.logger.metric('request_duration', totalDuration, 'ms', {
      status_code: statusCode,
      success: !error,
    });

    if (error) {
      this.logger.error('Request failed', {
        error: error.message,
        stack: error.stack,
        duration_ms: totalDuration,
      });
    } else {
      this.logger.info('Request completed', {
        status_code: statusCode,
        duration_ms: totalDuration,
      });
    }
  }
}

// Error tracking integration
export class ErrorTracker {
  constructor(env, logger) {
    this.env = env;
    this.logger = logger;
  }

  // Send error to external tracking service (e.g., Sentry)
  async trackError(error, context = {}) {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      timestamp: new Date().toISOString(),
      context,
      environment: this.env.ENVIRONMENT || 'production',
    };

    this.logger.error('Error tracked', errorData);

    // Send to Sentry if configured
    if (this.env.SENTRY_DSN) {
      try {
        await this.sendToSentry(errorData);
      } catch (sentryError) {
        this.logger.warn('Failed to send error to Sentry', {
          error: sentryError.message,
        });
      }
    }

    // Send to Datadog if configured
    if (this.env.DATADOG_API_KEY) {
      try {
        await this.sendToDatadog(errorData);
      } catch (datadogError) {
        this.logger.warn('Failed to send error to Datadog', {
          error: datadogError.message,
        });
      }
    }

    return errorData;
  }

  // Send error to Sentry
  async sendToSentry(errorData) {
    const sentryPayload = {
      message: errorData.message,
      level: 'error',
      platform: 'javascript',
      timestamp: Math.floor(new Date(errorData.timestamp).getTime() / 1000),
      exception: {
        values: [{
          type: errorData.name,
          value: errorData.message,
          stacktrace: {
            frames: this.parseStackTrace(errorData.stack),
          },
        }],
      },
      extra: errorData.context,
      environment: errorData.environment,
    };

    const response = await fetch(`https://sentry.io/api/0/projects/${this.env.SENTRY_PROJECT}/store/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${this.env.SENTRY_DSN}`,
      },
      body: JSON.stringify(sentryPayload),
    });

    if (!response.ok) {
      throw new Error(`Sentry API error: ${response.status}`);
    }
  }

  // Send error to Datadog
  async sendToDatadog(errorData) {
    const datadogPayload = {
      logs: [{
        timestamp: errorData.timestamp,
        level: 'error',
        message: errorData.message,
        service: 'shopify-oauth-worker',
        source: 'cloudflare-worker',
        tags: [`environment:${errorData.environment}`],
        attributes: {
          error: {
            message: errorData.message,
            stack: errorData.stack,
            name: errorData.name,
          },
          context: errorData.context,
        },
      }],
    };

    const response = await fetch('https://http-intake.logs.datadoghq.com/v1/input', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'DD-API-KEY': this.env.DATADOG_API_KEY,
      },
      body: JSON.stringify(datadogPayload),
    });

    if (!response.ok) {
      throw new Error(`Datadog API error: ${response.status}`);
    }
  }

  // Parse stack trace for Sentry format
  parseStackTrace(stack) {
    if (!stack) return [];
    
    return stack.split('\n')
      .filter(line => line.trim())
      .map(line => ({
        filename: 'worker.js',
        function: line.trim(),
        lineno: 1,
        colno: 1,
      }));
  }
}

// Health check utilities
export function createHealthCheck(env) {
  return {
    // Basic health check
    async basic() {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    },

    // Deep health check with dependencies
    async deep() {
      const checks = {
        kv_shops: await this.checkKV(env.SHOPS, 'health-check'),
        kv_auth_states: await this.checkKV(env.AUTH_STATES, 'health-check'),
        kv_api_keys: await this.checkKV(env.API_KEYS, 'health-check'),
        shopify_api: await this.checkShopifyAPI(env),
      };

      const allHealthy = Object.values(checks).every(check => check.healthy);
      
      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        checks,
      };
    },

    // Check KV namespace health
    async checkKV(namespace, key) {
      try {
        const testValue = `health-check-${Date.now()}`;
        await namespace.put(key, testValue, { expirationTtl: 60 });
        const retrieved = await namespace.get(key);
        await namespace.delete(key);
        
        return {
          healthy: retrieved === testValue,
          latency_ms: 0, // Could measure actual latency
        };
      } catch (error) {
        return {
          healthy: false,
          error: error.message,
        };
      }
    },

    // Check Shopify API connectivity
    async checkShopifyAPI(env) {
      try {
        // Simple API call to check connectivity
        const response = await fetch('https://shopify.dev/api', {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000),
        });
        
        return {
          healthy: response.ok,
          status_code: response.status,
        };
      } catch (error) {
        return {
          healthy: false,
          error: error.message,
        };
      }
    },
  };
}

// Initialize monitoring for a request
export function initializeMonitoring(request, env) {
  const requestId = generateRequestId();
  const context = {
    method: request.method,
    url: request.url,
    userAgent: request.headers.get('User-Agent'),
    ip: request.headers.get('CF-Connecting-IP'),
    country: request.headers.get('CF-IPCountry'),
  };

  setRequestContext(requestId, context);
  
  const logger = new StructuredLogger(requestId, context);
  const monitor = new PerformanceMonitor(logger);
  const errorTracker = new ErrorTracker(env, logger);

  return {
    requestId,
    logger,
    monitor,
    errorTracker,
  };
}

// Cleanup function to run periodically
export function performCleanup() {
  cleanupRequestContexts();
}