// Health Check Handler

import { createJsonResponse } from '../utils/index.js';

// Health Check Endpoint
export async function handleHealthCheck(env, logger) {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    checks: {},
  };

  // Check KV namespace availability
  try {
    await env.SHOPS.get('__health_check__');
    health.checks.shops_kv = 'ok';
  } catch (error) {
    health.checks.shops_kv = 'error';
    health.status = 'degraded';
    if (logger) {
      logger.error('SHOPS KV health check failed', { error: error.message });
    }
  }

  try {
    await env.AUTH_STATES.get('__health_check__');
    health.checks.auth_states_kv = 'ok';
  } catch (error) {
    health.checks.auth_states_kv = 'error';
    health.status = 'degraded';
    if (logger) {
      logger.error('AUTH_STATES KV health check failed', { error: error.message });
    }
  }

  try {
    await env.API_KEYS.get('__health_check__');
    health.checks.api_keys_kv = 'ok';
  } catch (error) {
    health.checks.api_keys_kv = 'error';
    health.status = 'degraded';
    if (logger) {
      logger.error('API_KEYS KV health check failed', { error: error.message });
    }
  }

  // Check required environment variables
  const requiredVars = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'APP_URL'];
  const missingVars = [];

  for (const varName of requiredVars) {
    if (!env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    health.checks.environment = `missing: ${missingVars.join(', ')}`;
    health.status = 'degraded';
  } else {
    health.checks.environment = 'ok';
  }

  const statusCode = health.status === 'ok' ? 200 : 503;

  return createJsonResponse(health, statusCode, {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });
}
