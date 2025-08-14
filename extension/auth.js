class ShopifyOAuth {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this.token = null;
  }
  
  async authenticate(shop) {
    // Start OAuth flow
    const response = await fetch(`${this.workerUrl}/auth/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shop }),
    });
    
    const { authUrl } = await response.json();
    
    // Open auth URL in new tab
    return new Promise((resolve, reject) => {
      chrome.tabs.create({ url: authUrl }, (tab) => {
        // Listen for auth success
        chrome.tabs.onUpdated.addListener(function listener(tabId, info, updatedTab) {
          if (tabId === tab.id && updatedTab.url?.includes('auth-success.html')) {
            const url = new URL(updatedTab.url);
            const token = url.searchParams.get('token');
            
            if (token) {
              chrome.tabs.remove(tabId);
              chrome.tabs.onUpdated.removeListener(listener);
              
              this.token = token;
              chrome.storage.local.set({ shopifyToken: token });
              resolve({ success: true, token });
            }
          }
        });
      });
    });
  }
  
  async makeApiCall(endpoint, options = {}) {
    if (!this.token) {
      const stored = await chrome.storage.local.get('shopifyToken');
      this.token = stored.shopifyToken;
    }
    
    const response = await fetch(
      `${this.workerUrl}/api/proxy?endpoint=${encodeURIComponent(endpoint)}`,
      {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.status === 401) {
      // Token expired, need to re-authenticate
      throw new Error('Authentication required');
    }
    
    return response.json();
  }
}

// Usage
const oauth = new ShopifyOAuth('https://your-worker.workers.dev');

// Authenticate
await oauth.authenticate('store.myshopify.com');

// Make API calls
const products = await oauth.makeApiCall('/products.json');