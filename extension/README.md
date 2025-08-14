# Shopify Auth Client for Browser Extensions

Universal authentication module for browser extensions to connect with Shopify stores through a Cloudflare Worker OAuth proxy.

## Features

- Complete OAuth authentication with Shopify
- Automatic token management and caching
- Cross-browser support (Chrome, Firefox, Edge)
- Zero dependencies, single-file solution
- Built-in retry logic for failed requests

## Installation

1. Copy `auth.js` into your extension directory
2. Add permissions to `manifest.json`:

```json
{
  "permissions": ["storage", "tabs", "https://your-worker.workers.dev/*"],
  "background": {
    "scripts": ["auth.js", "background.js"]
  }
}
```

## Usage

```javascript
const auth = new ShopifyAuthClient('https://your-worker.workers.dev');
await auth.authenticate('store.myshopify.com');
const products = await auth.get('/products.json');
```

## API Reference

### Constructor
```javascript
new ShopifyAuthClient(workerUrl, options)
```

Parameters:
- `workerUrl` (string) - Cloudflare Worker URL
- `options` (object) - Optional configuration
  - `debug` (boolean) - Enable debug logging
  - `authMethod` ('tab'|'popup') - OAuth method
  - `tokenTTL` (number) - Token lifetime in ms
  - `retryAttempts` (number) - Max retry attempts

### Methods

- `authenticate(shop)` - Start OAuth flow or use cached token
- `api(endpoint, options)` - Make authenticated API call
- `get(endpoint)` - GET request
- `post(endpoint, data)` - POST request  
- `put(endpoint, data)` - PUT request
- `delete(endpoint)` - DELETE request
- `isAuthenticated()` - Check auth status
- `getShop()` - Get current shop domain
- `logout()` - Clear credentials

## Implementation Examples

### Basic Setup
```javascript
const auth = new ShopifyAuthClient('https://your-worker.workers.dev');

// Auto-authenticate and fetch data
if (!auth.isAuthenticated()) {
  await auth.authenticate('store.myshopify.com');
}
const products = await auth.get('/products.json?limit=10');
```

### Multi-shop Management
```javascript
class MultiShopManager {
  constructor(workerUrl) {
    this.clients = new Map();
    this.workerUrl = workerUrl;
  }
  
  async getClient(shop) {
    if (!this.clients.has(shop)) {
      const client = new ShopifyAuthClient(this.workerUrl);
      await client.authenticate(shop);
      this.clients.set(shop, client);
    }
    return this.clients.get(shop);
  }
}
```

## Chrome Extension Integration

### manifest.json (V3)
```json
{
  "manifest_version": 3,
  "permissions": ["storage", "tabs"],
  "host_permissions": [
    "https://your-worker.workers.dev/*",
    "https://*.myshopify.com/*"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

### background.js
```javascript
import ShopifyAuthClient from './auth.js';

const auth = new ShopifyAuthClient('https://your-worker.workers.dev');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'authenticate') {
    auth.authenticate(request.shop)
      .then(result => sendResponse({ success: true, result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
```

## Troubleshooting

### Common Issues

- **Auth tab closes immediately**: Check worker URL and shop domain format
- **Token expired**: Client auto-refreshes tokens, use `auth.logout()` if needed  
- **CORS errors**: Add worker URL to `host_permissions` in manifest
- **Rate limiting**: Client auto-retries with exponential backoff

### Debug Mode
```javascript
const auth = new ShopifyAuthClient(workerUrl, { debug: true });
```

## Browser Support
Chrome, Firefox, Edge (Manifest V2 & V3)