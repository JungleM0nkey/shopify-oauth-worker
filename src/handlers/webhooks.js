import { AuthenticationError } from '../errors/index.js';
import { ERROR_MESSAGES } from '../utils/constants.js';
import { verifyWebhookHmac } from '../utils/hmac.js';

// Handle Webhook Requests
export async function handleWebhook(request, env, topic) {
  // Verify webhook authenticity
  const hmac = request.headers.get('X-Shopify-Hmac-Sha256');
  const body = await request.text();
  
  const isValidWebhook = await verifyWebhookHmac(body, hmac, env.SHOPIFY_API_SECRET);
  if (!isValidWebhook) {
    console.error('Webhook HMAC verification failed');
    throw new AuthenticationError(ERROR_MESSAGES.INVALID_WEBHOOK, 401);
  }
  
  const data = JSON.parse(body);
  
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
export async function handleCustomerRedact(data, env) {
  console.log('Customer redact webhook received');
  // Implementation for customer data redaction would go here
  // This is typically used to remove customer data from your systems
}

// Handle Customer Data Request Webhook
export async function handleCustomerDataRequest(data, env) {
  console.log('Customer data request webhook received');
  // Implementation for customer data request would go here
  // This is typically used to provide customer data for GDPR requests
}