# Security Features

This document outlines the security features implemented in the Shopify OAuth Worker to protect against common web vulnerabilities and ensure safe operation as a public-facing gateway.

## Overview

The worker implements multiple layers of security controls:

- **CORS Origin Validation**: Configurable allowlist instead of wildcard (`*`)
- **Rate Limiting**: Multi-tier rate limiting by API key, shop, and IP address
- **Input Validation**: Comprehensive validation and sanitization for all endpoints
- **Security Headers**: Content Security Policy (CSP) and security headers for HTML responses
- **HMAC Verification**: Enhanced webhook and OAuth callback verification
- **Request Size Limits**: Protection against resource exhaustion attacks

## CORS Configuration

### Configurable Origins
The worker supports configurable CORS origins through the `ALLOWED_ORIGINS` environment variable:

```toml
# wrangler.toml
[vars]
ALLOWED_ORIGINS = "https://admin.shopify.com,https://*.myshopify.com"
```

### Wildcard Support
Wildcard patterns are supported for domain matching:
- `*.myshopify.com` - matches any Shopify store
- `https://*.example.com` - matches any subdomain of example.com

### Development Mode
For development only, you can use `*` to allow all origins:
```toml
ALLOWED_ORIGINS = "*"  # ⚠️ Use only in development
```

## Rate Limiting

The worker implements multi-tier rate limiting:

### By API Key
- **Limit**: 100 requests per minute
- **Scope**: Per unique API key
- **Applied to**: `/api/proxy` endpoint

### By Shop
- **Limit**: 50 requests per minute  
- **Scope**: Per shop domain
- **Applied to**: All authenticated endpoints

### By IP Address
- **Limit**: 20 requests per minute
- **Scope**: Per client IP address
- **Applied to**: All unauthenticated requests

### Auth Endpoints
- **Limit**: 10 requests per hour
- **Scope**: Per shop domain
- **Applied to**: `/api/auth` endpoint

### Headers
Rate limit information is provided in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: When the rate limit resets
- `Retry-After`: Seconds to wait when rate limited (429 responses)

## Input Validation

### Shop Domain Validation
- Must match pattern: `[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com`
- Prevents path traversal attempts (`../`, `--`)
- Case insensitive, normalized to lowercase

### API Endpoint Validation
- Must end with `.json` extension
- Must start with `/`
- Blocks dangerous paths:
  - `/admin/api/` (direct admin API access)
  - `/webhooks/` (webhook endpoints)
  - `/auth/` (auth endpoints)
  - Path traversal patterns (`../`)

### API Key Validation
- Must be valid UUID v4 format
- Validated on every API request

### String Sanitization
All user input is sanitized to remove:
- HTML tags (`<script>`, `<img>`, etc.)
- Special characters (`<`, `>`, `"`, `'`, `&`)
- Control characters
- JavaScript and data URL protocols
- Length limits enforced

## Security Headers

### JSON Responses
All JSON responses include:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

### HTML Responses
HTML responses include comprehensive security headers:
- **Content Security Policy**: Restricts script, style, and resource loading
- **X-Frame-Options**: Controls iframe embedding
- **Strict-Transport-Security**: Forces HTTPS connections
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **Referrer-Policy**: Controls referrer information leakage
- **Permissions-Policy**: Disables sensitive APIs (camera, microphone, etc.)

### Content Security Policy
Default CSP policy:
```
default-src 'self'; 
script-src 'self' 'nonce-{random}' https://unpkg.com https://cdn.shopify.com; 
style-src 'self' 'unsafe-inline'; 
img-src 'self' data: https:; 
connect-src 'self' https://*.myshopify.com; 
frame-ancestors 'self' https://admin.shopify.com https://*.myshopify.com;
```

## HMAC Verification

### OAuth Callbacks
- Verifies HMAC-SHA256 signatures on OAuth callback parameters
- Uses timing-safe comparison to prevent timing attacks
- Sorts parameters alphabetically as required by Shopify

### Webhooks
- Verifies `X-Shopify-Hmac-Sha256` header
- Validates webhook topic against allowlist
- Checks required Shopify headers (`X-Shopify-Topic`, `X-Shopify-Shop-Domain`)
- Body size limits (1MB maximum)

## Request Protection

### Size Limits
- Auth requests: 1KB maximum body size
- Proxy requests: 10KB maximum body size  
- Webhook requests: 1MB maximum body size

### Method Validation
- Only allows safe HTTP methods: GET, POST, PUT, DELETE, PATCH
- Blocks dangerous methods like TRACE, CONNECT

### Content Type Validation
- Requires `application/json` for API endpoints
- Validates content type headers

### User Agent Filtering
Basic bot protection blocks known patterns:
- Generic bots, crawlers, scrapers
- Command line tools (curl, wget)
- Automated tools

## Error Handling

### Security-First Error Messages
- Generic error messages to prevent information leakage
- Detailed errors logged server-side only
- No stack traces in production responses

### Rate Limiting Responses
When rate limited, responses include:
- HTTP 429 status code
- `Retry-After` header with wait time
- JSON error message with reset time

## Monitoring and Logging

### Security Events Logged
- HMAC verification failures
- Rate limit violations
- Invalid input attempts
- Webhook authentication failures

### Sensitive Data Protection
- No credentials logged in plain text
- User agents truncated to 200 characters
- Request bodies not logged

## Best Practices

### Environment Configuration
- Always set `ALLOWED_ORIGINS` for production
- Use strong, unique `SHOPIFY_API_SECRET`
- Regularly rotate API credentials
- Monitor rate limit violations

### Network Security
- Use HTTPS only (enforced by security headers)
- Configure proper DNS and firewall rules
- Monitor for unusual traffic patterns

### Incident Response
- Monitor logs for security events
- Have procedures for API key revocation
- Plan for rate limit adjustments during traffic spikes

## Testing

Run the security validation tests:
```bash
node test-security.js
```

This validates:
- Input sanitization functions
- Domain validation logic
- API key format validation
- Endpoint path validation
- HTTP method validation
- Webhook topic validation