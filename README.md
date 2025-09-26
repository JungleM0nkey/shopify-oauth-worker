

A Cloudflare Worker that provides OAuth authentication and API gateway for browser extensions to connect with Shopify storefronts.

I built this to solve an iframe limitation chromium extensions have with oauth, however this will work with other clients as well.


1. **Clone the repository**
   ```bash
   cd shopify-oauth-worker/app
   ```

2. **Create KV namespaces**
   ```bash
   wrangler kv:namespace create "SHOPS"
   wrangler kv:namespace create "AUTH_STATES"
   wrangler kv:namespace create "API_KEYS"
   ```

3. **Update wrangler.toml**
   
   Replace the namespace IDs with the ones you just created:
   ```toml
   [[kv_namespaces]]
   binding = "SHOPS"
   id = "YOUR_SHOPS_ID"
   
   [[kv_namespaces]]
   binding = "AUTH_STATES"
   id = "YOUR_AUTH_STATES_ID"
   
   [[kv_namespaces]]
   binding = "API_KEYS"
   id = "YOUR_API_KEYS_ID"
   ```

4. **Set secrets**
   ```bash
   wrangler secret put SHOPIFY_API_KEY
   wrangler secret put SHOPIFY_API_SECRET
   ```

5. **Deploy**
   ```bash
   wrangler publish
   ```

## Configuration

### Shopify App Settings

In your Shopify Partner dashboard:

- **App URL**: `https://your-worker.workers.dev/`
- **Allowed redirection URL**: `https://your-worker.workers.dev/auth/callback`
- **Required webhooks**:
  - Customer data request endpoint
  - Customer redact endpoint
  - Shop redact endpoint

### Environment Variables

Update `wrangler.toml`:

```toml
[vars]
SHOPIFY_APP_HANDLE = "your-app-handle"
APP_URL = "https://your-worker.workers.dev"
OAUTH_SCOPES="read_orders"
SHOPIFY_API_VERSION="2025-07"
ENVIRONMENT="production"
```

### Production Secrets

Set these secrets for production deployment:

```bash
# Required
wrangler secret put SHOPIFY_API_KEY
wrangler secret put SHOPIFY_API_SECRET

# Recommended for production
wrangler secret put ENCRYPTION_KEY  # For encrypting sensitive KV data

# Optional monitoring integrations
wrangler secret put SENTRY_DSN      # For error tracking
wrangler secret put SENTRY_PROJECT  # Sentry project ID
wrangler secret put DATADOG_API_KEY # For logs and monitoring
```

## Production Features

### 🔐 Data Encryption
- Sensitive data (access tokens, API keys) encrypted at rest in KV storage
- Uses AES-GCM encryption with Web Crypto API
- Backward compatible with existing unencrypted data

### 📊 Monitoring & Observability
- Structured JSON logging with request tracing
- Performance metrics collection
- Error tracking with Sentry/Datadog integration
- Request correlation IDs for debugging

### 🏥 Health Checks
- Multiple health check endpoints for different monitoring needs
- Kubernetes-style readiness and liveness probes
- Deep health checks with dependency validation

### 🛡️ Security & Rate Limiting
- Built-in rate limiting with different policies per endpoint type
- DDoS protection with suspicious activity detection
- Enhanced error handling with proper HTTP status codes

### 📈 Performance Monitoring
- Request duration tracking
- Shopify API rate limit header passthrough
- Automatic retry logic for webhook registration

## API Endpoints

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/` | GET | App entry point (embedded or landing page) | 100/min |
| `/auth` | GET | Initiate OAuth flow | 20/hour |
| `/auth/callback` | GET | OAuth callback handler | 20/hour |
| `/api/auth` | POST | Generate API key for extensions | 100/min |
| `/api/proxy` | POST | Proxy requests to Shopify API | 100/min |
| `/health` | GET | Basic health check | 60/min |
| `/health/ready` | GET | Readiness probe (Kubernetes) | 60/min |
| `/health/live` | GET | Liveness probe (Kubernetes) | 60/min |
| `/health/deep` | GET | Deep health check with dependencies | 60/min |
| `/status` | GET | Detailed status information | 60/min |
| `/metrics` | GET | Performance metrics (Prometheus format) | 60/min |
| `/webhooks/*` | POST | Shopify webhook handlers | 1000/min |

## Extension Integration

Browser extensions can connect using:

```javascript
// 1. Authenticate
const response = await fetch('https://your-worker.workers.dev/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shop: 'store.myshopify.com' })
});

const { api_key } = await response.json();

// 2. Make API calls
const products = await fetch('https://your-worker.workers.dev/api/proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${api_key}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    endpoint: '/products.json',
    method: 'GET'
  })
});
```

## Development

```bash
# Run locally
wrangler dev

# View logs
wrangler tail

# Check KV storage
wrangler kv key list --namespace-id=YOUR_NAMESPACE_ID
```

