# API Documentation

## Endpoints

### Authentication

#### `GET /auth`
Initiates OAuth flow for Shopify store installation.

**Parameters:**
- `shop` (required): Shopify store domain (e.g., `store.myshopify.com`)

**Response:** Redirects to Shopify OAuth authorization page

#### `GET /auth/callback`
Handles OAuth callback from Shopify.

**Parameters:**
- `code`: Authorization code from Shopify
- `shop`: Shop domain
- `state`: State parameter for CSRF protection
- `hmac`: HMAC signature for verification

**Response:** Redirects to Shopify admin app page

### Extension API

#### `POST /api/auth`
Generates API key for extension authentication.

**Request Body:**
```json
{
  "shop": "store.myshopify.com"
}
```

**Response:**
```json
{
  "success": true,
  "api_key": "uuid-api-key",
  "shop": "store.myshopify.com"
}
```

#### `POST /api/proxy`
Proxies requests to Shopify API.

**Headers:**
- `Authorization: Bearer {api_key}`

**Request Body:**
```json
{
  "endpoint": "/products.json",
  "method": "GET",
  "data": {}
}
```

**Response:** Returns Shopify API response

### Webhooks

#### `POST /webhooks/customers/redact`
Handles customer data redaction requests (GDPR compliance).

#### `POST /webhooks/shop/redact`
Handles shop data redaction requests.

#### `POST /webhooks/customers/data_request`
Handles customer data requests.

### Root Endpoints

#### `GET /`
Returns landing page or app interface based on parameters.

**Parameters:**
- `shop` (optional): Shop domain
- `embedded` (optional): Whether running in embedded context
- `host` (optional): Host parameter for embedded apps

## Error Responses

All API endpoints return appropriate HTTP status codes:

- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication errors)
- `403`: Forbidden (access denied)
- `404`: Not Found
- `500`: Internal Server Error

Error responses include details:
```json
{
  "error": "Error message",
  "details": "Additional details if available"
}
```

## CORS Support

All API endpoints include CORS headers for browser compatibility:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key`