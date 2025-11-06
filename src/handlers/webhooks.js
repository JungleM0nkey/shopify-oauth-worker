import { AuthenticationError, ValidationError } from '../errors/index.js';
import { ERROR_MESSAGES } from '../utils/constants.js';
import { verifyWebhookHmac } from '../utils/hmac.js';

// Handle Webhook Requests
export async function handleWebhook(request, env, topic, logger) {
  // Verify webhook authenticity
  const hmac = request.headers.get('X-Shopify-Hmac-Sha256');
  const body = await request.text();

  const isValidWebhook = await verifyWebhookHmac(body, hmac, env.SHOPIFY_API_SECRET);
  if (!isValidWebhook) {
    if (logger) {
      logger.error('Webhook HMAC verification failed', { topic });
    } else {
      console.error('Webhook HMAC verification failed');
    }
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_WEBHOOK, 401);
  }

  // Parse JSON with error handling
  let data;
  try {
    data = JSON.parse(body);
  } catch (error) {
    if (logger) {
      logger.error('Failed to parse webhook JSON', { topic, error: error.message });
    } else {
      console.error('Failed to parse webhook JSON:', error);
    }
    throw new ValidationError('Invalid JSON in webhook payload');
  }

  switch (topic) {
    case 'shop/redact':
      await handleShopRedact(data, env);
      break;
    case 'customers/redact':
      await handleCustomerRedact(data, env);
      break;
    case 'customers/data_request':
      await handleCustomerDataRequest(data, env);
      break;
  }

  return new Response('', { status: 200 });
}

// Handle Shop Redact Webhook
export async function handleShopRedact(data, env) {
  const shop = data.shop_domain;
  if (shop) {
    await env.SHOPS.delete(shop);
    console.log(`Shop data deleted for: ${shop}`);
  }
}

// Handle Customer Redact Webhook
export async function handleCustomerRedact(data, _env) {
  const shopDomain = data.shop_domain;
  const customerId = data.customer?.id;

  console.log('Customer redact webhook received', {
    shop: shopDomain,
    customerId,
  });

  // This app doesn't store customer-specific data
  // We only store shop-level OAuth tokens in the SHOPS KV namespace
  // and API keys in API_KEYS namespace (which are shop-scoped, not customer-scoped)

  // If you add customer-specific data storage in the future, implement deletion here:
  // 1. Query all KV keys associated with this customer
  // 2. Delete customer data from KV or database
  // 3. Log the deletion for audit purposes

  // For now, log that no customer data is stored
  console.log('No customer-specific data stored for customer', {
    shop: shopDomain,
    customerId,
    note: 'This app only stores shop-level OAuth tokens',
  });

  return {
    success: true,
    message: 'No customer data stored',
  };
}

// Handle Customer Data Request Webhook
export async function handleCustomerDataRequest(data, _env) {
  const shopDomain = data.shop_domain;
  const customerId = data.customer?.id;

  console.log('Customer data request webhook received', {
    shop: shopDomain,
    customerId,
  });

  // This app doesn't store customer-specific data
  // We only store shop-level OAuth tokens and API keys

  // If you add customer-specific data storage in the future, implement data export here:
  // 1. Query all data associated with this customer
  // 2. Format data according to GDPR requirements
  // 3. Return data or send to specified endpoint

  // For compliance, return an empty dataset with explanation
  const customerData = {
    shop_domain: shopDomain,
    customer_id: customerId,
    data_stored: null,
    explanation:
      'This application does not store any customer-specific data. It only stores shop-level OAuth tokens for API access.',
    timestamp: new Date().toISOString(),
  };

  console.log('Customer data request fulfilled', customerData);

  // In production, you would typically:
  // 1. Store this response for audit purposes
  // 2. Send to Shopify's data request endpoint if configured
  // 3. Notify shop owner

  return customerData;
}
