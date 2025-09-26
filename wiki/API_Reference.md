# API Reference

This document provides detailed information about all available endpoints in the Shopify OAuth Worker.

## Base URL

All API calls should be made to your deployed worker URL:
```
https://your-worker.workers.dev
```

## Authentication

The worker uses different authentication methods depending on the endpoint:

- **None**: Public endpoints (root, OAuth initiation)
- **HMAC**: Shopify-signed requests (OAuth callbacks, webhooks)
- **Bearer Token**: Extension API calls using generated API keys

## Endpoints

### Public Endpoints

#### `GET /`

**Description**: App entry point that serves either a landing page or embedded app interface.

**Parameters**:
- `embedded` (query, optional): Set to "1" for embedded app context
- `shop` (query, optional): Shop domain for embedded context
- `host` (query, optional): Base64 encoded host parameter
- `hmac` (query, optional): HMAC signature for embedded context

**Response**: HTML page (landing or embedded app)

**Example**:
```bash
curl https://your-worker.workers.dev/
```

---

#### `GET /auth`

**Description**: Initiates OAuth authorization flow with Shopify.

**Parameters**:
- `shop` (query, required): Shop domain (e.g., "example.myshopify.com")

**Response**: 
- Success: 302 redirect to Shopify OAuth page
- Error: 400 with error details

**Example**:
```bash
curl "https://your-worker.workers.dev/auth?shop=example.myshopify.com"
```

---

### OAuth Callback

#### `GET /auth/callback`

**Description**: Handles OAuth callback from Shopify after user authorization.

**Parameters**:
- `code` (query, required): Authorization code from Shopify
- `shop` (query, required): Shop domain
- `state` (query, required): CSRF protection state
- `hmac` (query, required): HMAC signature for verification

**Response**:
- Success: 302 redirect to success page or app
- Error: 403/400 with error details

**Example**: This endpoint is called automatically by Shopify during OAuth flow.

---

### Extension API

#### `POST /api/auth`

**Description**: Generates API key for browser extension authentication.

**Request Body**:
```json
{
  "shop": "example.myshopify.com"
}
```

**Response**:
```json
{
  "success": true,
  "api_key": "ext_abc123...",
  "expires_at": "2024-04-01T10:00:00Z"
}
```

**Error Response**:
```json
{
  "error": "App not installed on this shop",
  "auth_url": "https://example.myshopify.com/admin/oauth/authorize?..."
}
```

**Example**:
```bash
curl -X POST https://your-worker.workers.dev/api/auth \
  -H "Content-Type: application/json" \
  -d '{"shop":"example.myshopify.com"}'
```

---

#### `POST /api/proxy`

**Description**: Proxies API requests to Shopify Admin API with authentication.

**Headers**:
- `Authorization: Bearer <api_key>` (required)
- `Content-Type: application/json`

**Request Body**:
```json
{
  "endpoint": "/admin/api/2025-01/products.json",
  "method": "GET",
  "params": {
    "limit": 10,
    "fields": "id,title,handle"
  },
  "body": {}
}
```

**Response**: Direct proxy of Shopify API response

**Example**:
```bash
curl -X POST https://your-worker.workers.dev/api/proxy \
  -H "Authorization: Bearer ext_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "/admin/api/2025-01/products.json",
    "method": "GET",
    "params": {"limit": 5}
  }'
```

---

### Webhook Endpoints

#### `POST /webhooks/customers/data_request`

**Description**: GDPR compliance webhook for customer data requests.

**Headers**:
- `X-Shopify-Hmac-Sha256`: HMAC signature for verification

**Request Body**: Shopify webhook payload

**Response**: 
```json
{
  "success": true,
  "message": "Data request processed"
}
```

---

#### `POST /webhooks/customers/redact`

**Description**: GDPR compliance webhook for customer data deletion.

**Headers**:
- `X-Shopify-Hmac-Sha256`: HMAC signature for verification

**Response**:
```json
{
  "success": true,
  "message": "Customer data redacted"
}
```

---

#### `POST /webhooks/shop/redact`

**Description**: GDPR compliance webhook for shop data deletion.

**Headers**:
- `X-Shopify-Hmac-Sha256`: HMAC signature for verification

**Response**:
```json
{
  "success": true,
  "message": "Shop data redacted"
}
```

---

## Error Handling

All endpoints return consistent error responses:

### Error Response Format
```json
{
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {
    "additional": "context"
  }
}
```

### Common HTTP Status Codes

- `200 OK`: Successful request
- `302 Found`: Redirect (OAuth flows)
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid API key
- `403 Forbidden`: HMAC verification failed
- `404 Not Found`: Endpoint not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_SHOP` | Shop domain format is invalid |
| `APP_NOT_INSTALLED` | App not installed on the shop |
| `INVALID_API_KEY` | API key is invalid or expired |
| `INVALID_HMAC` | HMAC signature verification failed |
| `MISSING_PARAMETERS` | Required parameters are missing |
| `RATE_LIMITED` | Too many requests |

## Rate Limiting

The worker implements rate limiting to prevent abuse:

- **Extension API**: 100 requests per minute per API key
- **OAuth endpoints**: 10 requests per minute per IP
- **Webhook endpoints**: 1000 requests per minute per shop

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## API Key Management

### API Key Format
API keys are prefixed to identify their type:
- Extension keys: `ext_` + random string
- Session keys: `ses_` + random string

### Key Expiration
- Extension API keys: 90 days (configurable)
- OAuth state keys: 10 minutes
- Session keys: 24 hours

### Key Rotation
API keys should be rotated regularly:
1. Generate new key via `/api/auth`
2. Update extension with new key
3. Old key remains valid until expiration

## Browser Extension Integration

### Authentication Flow

```javascript
// 1. Request API key
const authResponse = await fetch('/api/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ shop: 'example.myshopify.com' })
});

const authData = await authResponse.json();

if (authData.auth_url) {
  // App not installed - open OAuth flow
  chrome.tabs.create({ url: authData.auth_url });
  return;
}

// Store API key for future requests
const apiKey = authData.api_key;
```

### Making API Calls

```javascript
// Make authenticated API call
const response = await fetch('/api/proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    endpoint: '/admin/api/2025-01/products.json',
    method: 'GET',
    params: { limit: 10 }
  })
});

const data = await response.json();
```

### Error Handling

```javascript
async function makeApiCall(endpoint, options = {}) {
  try {
    const response = await fetch('/api/proxy', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        endpoint,
        method: options.method || 'GET',
        params: options.params || {},
        body: options.body || {}
      })
    });

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 401) {
        // API key expired - refresh
        await refreshApiKey();
        return makeApiCall(endpoint, options); // Retry
      }
      
      throw new Error(error.error || 'API call failed');
    }

    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

## Testing

### Using cURL

Test authentication:
```bash
curl -X POST https://your-worker.workers.dev/api/auth \
  -H "Content-Type: application/json" \
  -d '{"shop":"your-test-shop.myshopify.com"}'
```

Test API proxy:
```bash
curl -X POST https://your-worker.workers.dev/api/proxy \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint": "/admin/api/2025-01/shop.json",
    "method": "GET"
  }'
```

### Using JavaScript

```javascript
// Test function for browser console
async function testWorkerAPI() {
  const baseUrl = 'https://your-worker.workers.dev';
  
  // Test auth endpoint
  const authResponse = await fetch(`${baseUrl}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shop: 'your-shop.myshopify.com' })
  });
  
  console.log('Auth response:', await authResponse.json());
}
```

## Best Practices

### Security
- Always validate HMAC signatures for webhooks
- Rotate API keys regularly
- Use HTTPS for all requests
- Implement proper error handling

### Performance
- Cache frequently accessed data
- Implement request batching where possible
- Use appropriate HTTP methods
- Monitor rate limits

### Error Handling
- Always check response status codes
- Implement retry logic for temporary failures
- Log errors for debugging
- Provide meaningful error messages to users

## Changelog

See [CHANGELOG.md](../CHANGELOG.md) for API changes and updates.