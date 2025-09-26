
# Shopify OAuth Worker

A production-ready Cloudflare Worker that provides OAuth authentication and API gateway for browser extensions to connect with Shopify storefronts.

## Features

- 🔐 **Secure OAuth Flow**: Complete Shopify OAuth implementation with HMAC verification
- 🛡️ **Production Security**: CORS allowlisting, CSP headers, rate limiting, input validation
- 🚀 **High Performance**: Cloudflare Workers edge computing with global distribution
- 📊 **Monitoring Ready**: Health checks, structured logging, error tracking
- 🔄 **Resilient**: Retry logic, error recovery, graceful degradation
- 🎯 **Developer Friendly**: Clean API, comprehensive error handling, extensive documentation

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/JungleM0nkey/shopify-oauth-worker.git
   cd shopify-oauth-worker
   ```

2. **Create KV namespaces**
   ```bash
   wrangler kv:namespace create "SHOPS"
   wrangler kv:namespace create "AUTH_STATES" 
   wrangler kv:namespace create "API_KEYS"
   # Optional: for rate limiting
   wrangler kv:namespace create "RATE_LIMIT"
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

5. **Configure environment variables**
   
   Update the `[vars]` section in `wrangler.toml`:
   ```toml
   [vars]
   SHOPIFY_APP_HANDLE = "your-app-handle"
   APP_URL = "https://your-worker.workers.dev"
   OAUTH_SCOPES = "read_orders,read_products"
   SHOPIFY_API_VERSION = "2025-07"
   NODE_ENV = "production"
   ALLOWED_ORIGINS = "https://your-extension.com,https://your-app.com"
   ```

6. **Deploy**
   ```bash
   wrangler publish
   ```

## Production Configuration

### Security Configuration

For production deployments, configure these critical security settings:

```toml
[vars]
NODE_ENV = "production"
# Comma-separated list of allowed origins (CRITICAL for security)
ALLOWED_ORIGINS = "https://your-domain.com,https://app.your-domain.com"
# Custom CSP policy (optional)
CSP_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.shopify.com; connect-src 'self' https://*.myshopify.com; frame-ancestors https://*.myshopify.com https://admin.shopify.com;"
```

### Shopify App Settings

In your [Shopify Partner dashboard](https://partners.shopify.com):

- **App URL**: `https://your-worker.workers.dev/`
- **Allowed redirection URL**: `https://your-worker.workers.dev/auth/callback`
- **Required webhooks**:
  - Customer data request endpoint: `https://your-worker.workers.dev/webhooks/customers/data_request`
  - Customer redact endpoint: `https://your-worker.workers.dev/webhooks/customers/redact`
  - Shop redact endpoint: `https://your-worker.workers.dev/webhooks/shop/redact`

## API Endpoints

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/` | GET | App entry point (embedded or landing page) | No |
| `/auth` | GET | Initiate OAuth flow | No |
| `/auth/callback` | GET | OAuth callback handler | No |
| `/health` | GET | Health check endpoint | No |
| `/health/ready` | GET | Readiness check endpoint | No |
| `/api/auth` | POST | Generate API key for extensions | No* |
| `/api/proxy` | POST | Proxy requests to Shopify API | Yes |
| `/webhooks/*` | POST | GDPR webhook handlers | No** |

*Requires valid shop installation  
**Requires valid Shopify HMAC signature

## Extension Integration

Browser extensions can connect using this pattern:

```javascript
// 1. Authenticate with a shop
const authResponse = await fetch('https://your-worker.workers.dev/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shop: 'store.myshopify.com' })
});

const { api_key } = await authResponse.json();

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

const data = await products.json();
```

## Security Features

### CORS Protection
- Production deployments restrict origins to allowlisted domains
- Development allows localhost for testing
- Proper preflight handling with security headers

### Rate Limiting
- Configurable per-endpoint rate limiting
- IP-based tracking with sliding window
- Graceful degradation under load

### Input Validation
- All user inputs are sanitized and validated
- Shop domains verified against Shopify format
- API endpoints restricted to safe patterns

### Security Headers
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Frame-Options for clickjacking protection
- X-Content-Type-Options to prevent MIME sniffing
- XSS Protection headers

## Development

```bash
# Run locally
wrangler dev

# View real-time logs
wrangler tail

# Check KV storage contents
wrangler kv key list --namespace-id=YOUR_NAMESPACE_ID

# Test health endpoints
curl https://your-worker.workers.dev/health
curl https://your-worker.workers.dev/health/ready
```

### Testing

Basic test structure is provided in the `tests/` directory. To set up testing:
1. Add `package.json` with testing dependencies
2. Configure Jest or Vitest for Cloudflare Workers
3. Add Worker API mocks for local testing

## Troubleshooting

### Common Issues

1. **CORS Errors in Production**
   - Ensure `ALLOWED_ORIGINS` includes your domain
   - Check that `NODE_ENV` is set to "production"
   - Verify origins match exactly (including protocol)

2. **OAuth Callback Failures**
   - Verify `SHOPIFY_API_SECRET` is set correctly
   - Check that callback URL matches Shopify app settings
   - Ensure system time is synchronized for HMAC verification

3. **KV Namespace Errors**
   - Verify all namespace IDs are correct in `wrangler.toml`
   - Check that namespaces exist in your Cloudflare account
   - Ensure proper bindings are configured

## Architecture

The worker implements a secure, scalable OAuth gateway with comprehensive error handling, monitoring, and production-ready security features including CORS allowlisting, rate limiting, input validation, and security headers.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Run tests and ensure security checks pass
4. Commit your changes (`git commit -m 'Add amazing feature'`)
5. Push to the branch (`git push origin feature/amazing-feature`)
6. Open a Pull Request

## Support

- 📚 [Documentation](wiki/Getting_Started.md)
- 🐛 [Issue Tracker](https://github.com/JungleM0nkey/shopify-oauth-worker/issues)

