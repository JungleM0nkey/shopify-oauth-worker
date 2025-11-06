# Deployment Setup Guide

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Install globally with `npm install -g wrangler`
3. **Shopify Partner Account**: Create at [partners.shopify.com](https://partners.shopify.com)

## Setup Steps

### 1. Cloudflare Configuration

```bash
# Login to Cloudflare
wrangler login

# Create KV namespaces
wrangler kv:namespace create "SHOPS"
wrangler kv:namespace create "AUTH_STATES"
wrangler kv:namespace create "API_KEYS"
```

### 2. Update wrangler.toml

Replace the KV namespace IDs in `wrangler.toml` with the ones created above:

```toml
[[kv_namespaces]]
binding = "SHOPS"
id = "your-shops-namespace-id"

[[kv_namespaces]]
binding = "AUTH_STATES"
id = "your-auth-states-namespace-id"

[[kv_namespaces]]
binding = "API_KEYS"
id = "your-api-keys-namespace-id"
```

### 3. Configure Environment Variables

Update the `[vars]` section in `wrangler.toml`:

```toml
[vars]
SHOPIFY_APP_HANDLE = "your-app-handle"
SHOPIFY_API_VERSION = "2025-07"
OAUTH_SCOPES = "read_products,read_orders"
APP_URL = "https://your-worker.workers.dev"
```

### 4. Set Secrets

```bash
wrangler secret put SHOPIFY_API_KEY
wrangler secret put SHOPIFY_API_SECRET
```

### 5. Deploy

```bash
./deployment/deploy.sh
```

## Shopify App Configuration

In your Shopify Partner dashboard, configure:

- **App URL**: `https://your-worker.workers.dev/`
- **Allowed redirection URL**: `https://your-worker.workers.dev/auth/callback`
- **Webhooks**:
  - Customer data request: `https://your-worker.workers.dev/webhooks/customers/data_request`
  - Customer redact: `https://your-worker.workers.dev/webhooks/customers/redact`
  - Shop redact: `https://your-worker.workers.dev/webhooks/shop/redact`

## Testing

After deployment, test the endpoints:

1. Visit `https://your-worker.workers.dev/` - should show landing page
2. Visit `https://your-worker.workers.dev/?shop=test-shop.myshopify.com` - should redirect to install
3. Test the OAuth flow with a development store

## Monitoring

- Use Cloudflare dashboard to monitor worker performance
- Check logs with: `wrangler tail`
- Monitor KV storage usage in Cloudflare dashboard

## Troubleshooting

Common issues:

1. **KV Namespace errors**: Ensure namespace IDs are correct in wrangler.toml
2. **Secret errors**: Verify secrets are set with `wrangler secret list`
3. **Domain errors**: Check that APP_URL matches your worker URL
4. **Shopify errors**: Verify app configuration in Partner dashboard
