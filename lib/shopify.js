import { AuthenticationError } from './errors.js';
import { ERROR_MESSAGES } from './constants.js';
import { encryptKVData, decryptKVData } from './encryption.js';

// Exchange OAuth Code for Access Token
export async function exchangeCodeForToken(shop, code, env) {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.SHOPIFY_API_KEY,
      client_secret: env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  
  if (!response.ok) {
    throw new AuthenticationError(ERROR_MESSAGES.FAILED_TOKEN_EXCHANGE);
  }
  
  return await response.json();
}

// Get shop data with decryption
export async function getShopData(shop, env, logger = null) {
  try {
    const encryptedData = await env.SHOPS.get(shop);
    if (!encryptedData) {
      return null;
    }
    
    const shopData = await decryptKVData(encryptedData, env);
    
    if (logger) {
      logger.debug('Shop data retrieved successfully', { shop });
    }
    
    return shopData;
  } catch (error) {
    if (logger) {
      logger.error('Failed to retrieve shop data', { shop, error: error.message });
    }
    return null;
  }
}

// Store Shop Data in KV with encryption
export async function storeShopData(shop, tokenData, env, logger = null) {
  try {
    const shopData = {
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      installedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
    
    // Encrypt sensitive data before storing
    const encryptedData = await encryptKVData(shopData, env);
    
    await env.SHOPS.put(shop, encryptedData);
    
    if (logger) {
      logger.info('Shop data stored successfully', { shop, scope: tokenData.scope });
    }
  } catch (error) {
    if (logger) {
      logger.error('Failed to store shop data', { shop, error: error.message });
    }
    throw error;
  }
}

// Register Mandatory Webhooks with retry logic
export async function registerMandatoryWebhooks(shop, accessToken, env, logger = null) {
  const webhooks = [
    { topic: 'customers/redact', address: `${env.APP_URL}/webhooks/customers/redact` },
    { topic: 'shop/redact', address: `${env.APP_URL}/webhooks/shop/redact` },
    { topic: 'customers/data_request', address: `${env.APP_URL}/webhooks/customers/data_request` },
  ];
  
  const results = [];
  
  for (const webhook of webhooks) {
    const result = await registerWebhookWithRetry(shop, webhook, accessToken, env, logger);
    results.push({ topic: webhook.topic, success: result.success, error: result.error });
  }
  
  return results;
}

// Register a single webhook with retry logic
async function registerWebhookWithRetry(shop, webhook, accessToken, env, logger = null, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webhook }),
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });
      
      if (response.ok) {
        if (logger) {
          logger.info('Webhook registered successfully', { 
            shop, 
            topic: webhook.topic, 
            attempt 
          });
        }
        return { success: true };
      } else {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }
    } catch (error) {
      if (logger) {
        logger.warn('Webhook registration attempt failed', {
          shop,
          topic: webhook.topic,
          attempt,
          maxRetries,
          error: error.message,
        });
      }
      
      if (attempt === maxRetries) {
        if (logger) {
          logger.error('Failed to register webhook after all retries', {
            shop,
            topic: webhook.topic,
            error: error.message,
          });
        }
        return { success: false, error: error.message };
      }
      
      // Exponential backoff: wait 2^attempt seconds
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

// Proxy Request to Shopify API with enhanced error handling
export async function proxyToShopify(shop, endpoint, method, data, accessToken, env, logger = null) {
  const url = `https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}${endpoint}`;
  const startTime = Date.now();
  
  const options = {
    method,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      'User-Agent': 'Shopify OAuth Worker/1.0',
    },
    signal: AbortSignal.timeout(30000), // 30 second timeout
  };
  
  if (method !== 'GET' && data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const responseTime = Date.now() - startTime;
    
    if (logger) {
      logger.info('Shopify API request completed', {
        shop,
        endpoint,
        method,
        status: response.status,
        response_time_ms: responseTime,
      });
    }
    
    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      if (logger) {
        logger.warn('Shopify API rate limit hit', {
          shop,
          endpoint,
          retry_after: retryAfter,
        });
      }
      
      return {
        data: { 
          error: 'Rate limit exceeded',
          retry_after: retryAfter,
          message: 'Please retry after the specified time'
        },
        status: 429,
        headers: {
          'Retry-After': retryAfter,
        },
      };
    }
    
    // Handle other errors
    if (!response.ok) {
      const errorText = await response.text();
      if (logger) {
        logger.error('Shopify API error response', {
          shop,
          endpoint,
          status: response.status,
          error: errorText,
        });
      }
      
      return {
        data: { 
          error: 'Shopify API error',
          status: response.status,
          message: errorText 
        },
        status: response.status,
      };
    }
    
    const responseData = await response.json();
    
    return {
      data: responseData,
      status: response.status,
      headers: {
        'X-Shopify-API-Call-Limit': response.headers.get('X-Shopify-API-Call-Limit'),
        'X-Shopify-Shop-Api-Call-Limit': response.headers.get('X-Shopify-Shop-Api-Call-Limit'),
      },
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (logger) {
      logger.error('Shopify API request failed', {
        shop,
        endpoint,
        method,
        error: error.message,
        response_time_ms: responseTime,
      });
    }
    
    // Handle timeout specifically
    if (error.name === 'TimeoutError') {
      return {
        data: { 
          error: 'Request timeout',
          message: 'The request to Shopify API timed out'
        },
        status: 504,
      };
    }
    
    return {
      data: { 
        error: 'Network error',
        message: error.message 
      },
      status: 500,
    };
  }
}