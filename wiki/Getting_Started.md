# Getting Started with Shopify OAuth Worker

## Overview

The `shopify-oauth-worker` project provides a seamless integration for developers looking to connect Shopify storefronts with browser extensions using Cloudflare Workers. This lightweight solution allows for efficient authentication and API interactions, ensuring a smooth user experience while maintaining security best practices.

### Why Use This Worker?

Browser extensions face significant limitations when implementing OAuth flows:

- **iframe Restrictions**: Chrome extensions cannot use iframes for OAuth due to security policies
- **CORS Limitations**: Direct API calls to Shopify are blocked by CORS policies  
- **Token Security**: Storing access tokens in extension storage poses security risks
- **Rate Limiting**: Direct API calls from extensions can hit rate limits quickly

This worker solves these problems by:
- Handling OAuth server-side with proper security
- Providing CORS-enabled API endpoints for extensions
- Securely storing tokens in Cloudflare KV storage
- Implementing proper rate limiting and error handling

## Prerequisites

Before getting started, ensure you have:

### Required Accounts
- [Cloudflare account](https://cloudflare.com) with Workers plan
- [Shopify Partner account](https://partners.shopify.com) for creating apps
- Basic understanding of JavaScript and web APIs

### Development Tools
- [Node.js 18+](https://nodejs.org) for local development
- [Git](https://git-scm.com) for version control
- Code editor with JavaScript support (VS Code recommended)

### Shopify App Setup
1. Log into your Shopify Partner dashboard
2. Create a new app (choose "Custom app" for development)
3. Note your API key and secret (you'll need these later)
4. Configure app URLs (we'll set these up after deployment)

## Installation

### 1. Clone and Setup Repository

```bash
# Clone the repository
git clone https://github.com/JungleM0nkey/shopify-oauth-worker.git
cd shopify-oauth-worker

# Install dependencies
npm install

# Install Wrangler CLI globally
npm install -g wrangler
```

### 2. Authenticate with Cloudflare

```bash
# Login to Cloudflare (opens browser)
wrangler login

# Verify authentication
wrangler whoami
```

### 3. Create Required Resources

```bash
# Create KV namespaces for data storage
wrangler kv:namespace create "SHOPS"
wrangler kv:namespace create "AUTH_STATES"  
wrangler kv:namespace create "API_KEYS"

# Create preview namespaces for development
wrangler kv:namespace create "SHOPS" --preview
wrangler kv:namespace create "AUTH_STATES" --preview
wrangler kv:namespace create "API_KEYS" --preview
```

### 4. Configure wrangler.toml

Update your `wrangler.toml` file with the namespace IDs from the previous step:

```toml
name = "your-worker-name"
main = "worker.js"
compatibility_date = "2025-01-01"

# Production KV Namespaces
[[kv_namespaces]]
binding = "SHOPS"
id = "your-shops-namespace-id"
preview_id = "your-shops-preview-id"

[[kv_namespaces]]
binding = "AUTH_STATES"
id = "your-auth-states-namespace-id"
preview_id = "your-auth-states-preview-id"

[[kv_namespaces]]
binding = "API_KEYS"
id = "your-api-keys-namespace-id"
preview_id = "your-api-keys-preview-id"

# Environment Variables
[vars]
SHOPIFY_APP_HANDLE = "your-app-handle"
APP_URL = "https://your-worker.workers.dev"
OAUTH_SCOPES = "read_products,write_orders"
SHOPIFY_API_VERSION = "2025-01"

# Static file serving (optional)
[site]
bucket = "./pages"
```

### 5. Set Secrets

```bash
# Set your Shopify app credentials as secrets
wrangler secret put SHOPIFY_API_KEY
# Enter your API key when prompted

wrangler secret put SHOPIFY_API_SECRET  
# Enter your API secret when prompted
```

### 6. Deploy to Cloudflare

```bash
# Deploy to production
wrangler deploy

# Your worker will be available at: https://your-worker.workers.dev
```

## Initial Testing

### Test the Worker

```bash
# Test the root endpoint
curl https://your-worker.workers.dev/

# Test OAuth initiation
curl "https://your-worker.workers.dev/auth?shop=development-store.myshopify.com"

# Test API endpoint
curl -X POST https://your-worker.workers.dev/api/auth \
  -H "Content-Type: application/json" \
  -d '{"shop":"development-store.myshopify.com"}'
```

### Verify KV Storage

```bash
# List keys in your shops namespace
wrangler kv key list --namespace-id=YOUR_SHOPS_NAMESPACE_ID

# Check for any stored data
wrangler kv key get "test-key" --namespace-id=YOUR_SHOPS_NAMESPACE_ID
```

## Configure Shopify App

Now that your worker is deployed, configure your Shopify app:

### App URLs
- **App URL**: `https://your-worker.workers.dev/`
- **Allowed redirection URL**: `https://your-worker.workers.dev/auth/callback`

### Required Webhooks (GDPR Compliance)
- **Customer data request**: `https://your-worker.workers.dev/webhooks/customers/data_request`
- **Customer redact**: `https://your-worker.workers.dev/webhooks/customers/redact`  
- **Shop redact**: `https://your-worker.workers.dev/webhooks/shop/redact`

### App Permissions
Configure the scopes you specified in `OAUTH_SCOPES`. Common ones include:
- `read_products` - Read product data
- `write_products` - Modify products
- `read_orders` - Read order information
- `write_orders` - Modify orders

## Next Steps

With your worker deployed and configured:

1. **Test OAuth Flow**: Visit your app URL and test the installation process
2. **Integrate with Extension**: Follow the [Browser Extension Integration Guide](./Browser_Extension_Integration.md)
3. **Monitor Performance**: Use Cloudflare Analytics to monitor usage
4. **Setup Development**: Configure local development environment

## Common Issues

### Deployment Fails
- Verify Wrangler authentication: `wrangler whoami`
- Check namespace IDs in wrangler.toml
- Ensure secrets are set correctly

### OAuth Errors  
- Verify redirect URLs match exactly in Shopify app settings
- Check app credentials are correct
- Ensure shop domain format is valid

### Permission Errors
- Verify your Cloudflare account has Workers plan
- Check KV namespace permissions
- Ensure API key has correct permissions

## Getting Help

- 📖 [Full Documentation](../README.md)
- 🐛 [Report Issues](https://github.com/JungleM0nkey/shopify-oauth-worker/issues)
- 💬 [Community Discussions](https://github.com/JungleM0nkey/shopify-oauth-worker/discussions)
- 📚 [Shopify API Documentation](https://shopify.dev/api)
- 🔧 [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)