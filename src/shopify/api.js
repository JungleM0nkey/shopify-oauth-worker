import { AuthenticationError } from '../errors/index.js';
import { ERROR_MESSAGES } from '../utils/constants.js';

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
    }),
  );
}

// Register Mandatory Webhooks
export async function registerMandatoryWebhooks(shop, accessToken, env) {
  const webhooks = [
    { topic: 'customers/redact', address: `${env.APP_URL}/webhooks/customers/redact` },
    { topic: 'shop/redact', address: `${env.APP_URL}/webhooks/shop/redact` },
    { topic: 'customers/data_request', address: `${env.APP_URL}/webhooks/customers/data_request` },
  ];

  const results = [];

  for (const webhook of webhooks) {
    try {
      const response = await fetch(
        `https://${shop}/admin/api/${env.SHOPIFY_API_VERSION}/webhooks.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ webhook }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to register webhook ${webhook.topic}:`, {
          status: response.status,
          error: errorText,
        });
        results.push({
          topic: webhook.topic,
          success: false,
          error: `HTTP ${response.status}: ${errorText}`,
        });
      } else {
        const data = await response.json();
        console.log(`Successfully registered webhook: ${webhook.topic}`);
        results.push({
          topic: webhook.topic,
          success: true,
          webhookId: data.webhook?.id,
        });
      }
    } catch (error) {
      console.error(`Failed to register webhook ${webhook.topic}:`, error);
      results.push({
        topic: webhook.topic,
        success: false,
        error: error.message,
      });
    }
  }

  // Return results so caller can handle failures
  return results;
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

  // SECURITY FIX: Check response status before parsing
  // Parse response body regardless of status (Shopify returns JSON errors)
  let responseData;
  try {
    responseData = await response.json();
  } catch (error) {
    // If JSON parsing fails, return error information
    const text = await response.text();
    responseData = {
      error: 'Failed to parse Shopify API response',
      details: text,
    };
  }

  return {
    data: responseData,
    status: response.status,
    ok: response.ok,
    statusText: response.statusText,
  };
}
