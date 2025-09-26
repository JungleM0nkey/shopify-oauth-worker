// Health Check Endpoints Module
// Provides comprehensive health monitoring for production deployment

import { createHealthCheck } from './monitoring.js';
import { createJsonResponse } from './utils.js';

// Handle health check requests
export async function handleHealthCheck(request, env, type = 'basic') {
  const healthCheck = createHealthCheck(env);
  
  try {
    let result;
    
    switch (type) {
      case 'basic':
        result = await healthCheck.basic();
        break;
      case 'ready':
        result = await handleReadinessCheck(env);
        break;
      case 'live':
        result = await handleLivenessCheck(env);
        break;
      case 'deep':
        result = await healthCheck.deep();
        break;
      default:
        result = await healthCheck.basic();
    }
    
    const statusCode = result.status === 'healthy' ? 200 : 503;
    return createJsonResponse(result, statusCode);
    
  } catch (error) {
    return createJsonResponse({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    }, 503);
  }
}

// Kubernetes-style readiness check
async function handleReadinessCheck(env) {
  const checks = [];
  
  // Check if we can connect to KV stores
  try {
    await env.SHOPS.get('readiness-check');
    checks.push({ name: 'kv_shops', status: 'ready' });
  } catch (error) {
    checks.push({ name: 'kv_shops', status: 'not_ready', error: error.message });
  }
  
  try {
    await env.AUTH_STATES.get('readiness-check');
    checks.push({ name: 'kv_auth_states', status: 'ready' });
  } catch (error) {
    checks.push({ name: 'kv_auth_states', status: 'not_ready', error: error.message });
  }
  
  try {
    await env.API_KEYS.get('readiness-check');
    checks.push({ name: 'kv_api_keys', status: 'ready' });
  } catch (error) {
    checks.push({ name: 'kv_api_keys', status: 'not_ready', error: error.message });
  }
  
  // Check required environment variables
  const requiredEnvs = ['SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET'];
  for (const envVar of requiredEnvs) {
    if (env[envVar]) {
      checks.push({ name: `env_${envVar.toLowerCase()}`, status: 'ready' });
    } else {
      checks.push({ name: `env_${envVar.toLowerCase()}`, status: 'not_ready', error: 'Missing' });
    }
  }
  
  const allReady = checks.every(check => check.status === 'ready');
  
  return {
    status: allReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  };
}

// Kubernetes-style liveness check
async function handleLivenessCheck(env) {
  // Simple check to ensure the worker is responsive
  const startTime = Date.now();
  
  try {
    // Perform a simple operation
    const testData = { test: 'liveness-check', timestamp: new Date().toISOString() };
    const serialized = JSON.stringify(testData);
    const parsed = JSON.parse(serialized);
    
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      worker_instance: crypto.randomUUID().substring(0, 8),
    };
  } catch (error) {
    return {
      status: 'dead',
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}

// Comprehensive status endpoint with metrics
export async function handleStatusCheck(env) {
  const startTime = Date.now();
  
  try {
    // Gather system information
    const status = {
      service: 'shopify-oauth-worker',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      uptime_ms: Date.now(), // This would be actual uptime in a real deployment
      environment: env.ENVIRONMENT || 'production',
      
      // KV storage status
      storage: {
        shops_count: await getKVCount(env.SHOPS),
        auth_states_count: await getKVCount(env.AUTH_STATES),
        api_keys_count: await getKVCount(env.API_KEYS),
      },
      
      // Configuration status
      configuration: {
        shopify_api_configured: !!env.SHOPIFY_API_KEY,
        encryption_enabled: !!env.ENCRYPTION_KEY,
        monitoring_enabled: !!(env.SENTRY_DSN || env.DATADOG_API_KEY),
        cors_enabled: true,
      },
      
      // Performance metrics
      performance: {
        status_check_time_ms: Date.now() - startTime,
      },
    };
    
    return createJsonResponse(status, 200);
    
  } catch (error) {
    return createJsonResponse({
      service: 'shopify-oauth-worker',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
    }, 500);
  }
}

// Helper to get approximate KV count (not exact due to KV limitations)
async function getKVCount(namespace) {
  try {
    // KV doesn't provide count directly, so we use list with limit
    const keys = await namespace.list({ limit: 1000 });
    return keys.keys.length;
  } catch (error) {
    return -1; // Indicates error
  }
}

// Get detailed metrics for monitoring
export async function handleMetricsCheck(env) {
  const metrics = {
    timestamp: new Date().toISOString(),
    service: 'shopify-oauth-worker',
    
    // Request metrics (would be tracked in production)
    requests: {
      total: 0, // Would be tracked with actual counter
      success: 0,
      errors: 0,
      avg_response_time_ms: 0,
    },
    
    // Storage metrics
    storage: {
      shops: await getKVMetrics(env.SHOPS),
      auth_states: await getKVMetrics(env.AUTH_STATES),
      api_keys: await getKVMetrics(env.API_KEYS),
    },
    
    // System metrics
    system: {
      memory_usage: 'N/A', // Not available in CF Workers
      cpu_usage: 'N/A', // Not available in CF Workers
      response_time_p50_ms: 0,
      response_time_p95_ms: 0,
      response_time_p99_ms: 0,
    },
  };
  
  return createJsonResponse(metrics, 200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
}

// Get metrics for a KV namespace
async function getKVMetrics(namespace) {
  try {
    const startTime = Date.now();
    const keys = await namespace.list({ limit: 100 });
    const responseTime = Date.now() - startTime;
    
    return {
      accessible: true,
      key_count: keys.keys.length,
      response_time_ms: responseTime,
      has_more: !keys.list_complete,
    };
  } catch (error) {
    return {
      accessible: false,
      error: error.message,
    };
  }
}