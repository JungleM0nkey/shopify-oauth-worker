# Shopify OAuth Worker Documentation

## Overview

The Shopify OAuth Worker is a Cloudflare Worker that provides secure OAuth authentication and API gateway functionality for browser extensions to connect with Shopify stores.

## Architecture

The codebase is organized into modular components:

```
src/
├── errors/          # Error handling and custom error classes
├── handlers/        # Request handlers for different endpoints
├── shopify/         # Shopify API integration
├── templates/       # HTML template generation
├── utils/           # Utility functions and constants
└── validation/      # Input validation functions
```

## Core Modules

### Errors (`src/errors/`)

- **index.js**: Custom error classes (AuthenticationError, ValidationError, ConfigurationError)
- **error-handler.js**: Central error handling with appropriate responses

### Handlers (`src/handlers/`)

- **router.js**: Main request routing logic
- **oauth.js**: OAuth flow handling (initiation and callback)
- **api.js**: Extension authentication and API proxy
- **webhooks.js**: Shopify webhook processing

### Shopify (`src/shopify/`)

- **api.js**: Shopify API interactions (token exchange, data storage, webhooks)

### Templates (`src/templates/`)

- **index.js**: HTML template generation for various pages

### Utils (`src/utils/`)

- **constants.js**: Application constants and error messages
- **index.js**: General utility functions
- **hmac.js**: HMAC verification for security

### Validation (`src/validation/`)

- **index.js**: Input validation functions

## Key Features

1. **Secure OAuth Flow**: Standard OAuth 2.0 implementation with HMAC verification
2. **API Key Generation**: Secure API keys for extension authentication
3. **Request Proxying**: Secure proxy for Shopify API calls
4. **Webhook Handling**: GDPR compliance webhooks
5. **CORS Support**: Browser-friendly CORS headers
6. **Error Handling**: Comprehensive error handling with appropriate responses

## Security

- HMAC verification for OAuth callbacks and webhooks
- Timing-safe string comparison to prevent timing attacks
- Secure API key generation and storage
- Environment variable validation
- Input sanitization and validation

## Testing

Run tests with:

```bash
node tests/run-tests.js
```

## Deployment

The worker can be deployed using Wrangler:

```bash
wrangler publish
```

See the main README.md for complete setup instructions.
