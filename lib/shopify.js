import { AuthenticationError } from './errors.js';
import { ERROR_MESSAGES } from './constants.js';

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

// Store Shop Data in KV
export async function storeShopData(shop, tokenData, env) {
  await env.SHOPS.put(
    shop,
    JSON.stringify({
      accessToken: tokenData.access_token,
      scope: tokenData.scope,
      installedAt: new Date().toISOString(),
    })
  );
}

// Register Mandatory Webhooks
export async function registerMandatoryWebhooks(shop, accessToken, env) {
  const webhooks = [
    { topic: 'customers/redact', address: `${env.APP_URL}/webhooks/customers/redact` },
    { topic: 'shop/redact', address: `${env.APP_URL}/webhooks/shop/redact` },
    { topic: 'customers/data_request', address: `${env.APP_URL}/webhooks/customers/data_request` },
  ];
  
  for (const webhook of webhooks) {
    try {
      await fetch(`https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/webhooks.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ webhook }),
      });
    } catch (error) {
      console.error(`Failed to register webhook ${webhook.topic}:`, error);
    }
  }
}

// Proxy Request to Shopify API
export async function proxyToShopify(shop, endpoint, method, data, accessToken, env) {
  const url = `https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}${endpoint}`;
  const options = {
    method,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  };
  
  if (method !== 'GET' && data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  const responseData = await response.json();
  
  return {
    data: responseData,
    status: response.status,
  };
}