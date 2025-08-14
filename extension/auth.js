/**
 * Shopify OAuth Authentication Client for Browser Extensions
 * 
 * A drop-in authentication module for browser extensions to authenticate
 * with Shopify stores through a Cloudflare Worker OAuth proxy.
 * 
 * @example
 * const auth = new ShopifyAuthClient('https://your-worker.workers.dev');
 * await auth.authenticate('store.myshopify.com');
 * const products = await auth.api('/products.json');
 */

class ShopifyAuthClient {
  constructor(workerUrl, options = {}) {
    // Validate and store configuration
    if (!workerUrl) {
      throw new Error('ShopifyAuthClient: Worker URL is required');
    }
    
    this.workerUrl = workerUrl.replace(/\/$/, ''); // Remove trailing slash
    this.options = {
      debug: false,
      authMethod: 'tab', // 'tab' or 'popup'
      storagePrefix: 'shopify_auth_',
      tokenTTL: 86400000 * 30, // 30 days in milliseconds
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
    
    this.shop = null;
    this.token = null;
    this.tokenExpiry = null;
    this.authInProgress = false;
    
    // Detect browser type for API compatibility
    this.browser = this._detectBrowser();
    
    // Initialize by loading stored credentials
    this._loadStoredCredentials();
  }
  
  /**
   * Detect browser type for cross-browser compatibility
   */
  _detectBrowser() {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      return chrome;
    } else if (typeof browser !== 'undefined' && browser.runtime) {
      return browser;
    }
    throw new Error('ShopifyAuthClient: No compatible browser API found');
  }
  
  /**
   * Log debug messages if debug mode is enabled
   */
  _debug(...args) {
    if (this.options.debug) {
      console.log('[ShopifyAuth]', ...args);
    }
  }
  
  /**
   * Load stored credentials from browser storage
   */
  async _loadStoredCredentials() {
    try {
      const storageKey = `${this.options.storagePrefix}credentials`;
      const result = await this.browser.storage.local.get(storageKey);
      
      if (result[storageKey]) {
        const credentials = result[storageKey];
        const now = Date.now();
        
        // Check if token is still valid
        if (credentials.tokenExpiry && credentials.tokenExpiry > now) {
          this.shop = credentials.shop;
          this.token = credentials.token;
          this.tokenExpiry = credentials.tokenExpiry;
          this._debug('Loaded valid credentials for', this.shop);
        } else {
          // Token expired, clear it
          await this._clearStoredCredentials();
          this._debug('Cleared expired credentials');
        }
      }
    } catch (error) {
      this._debug('Error loading stored credentials:', error);
    }
  }
  
  /**
   * Store credentials in browser storage
   */
  async _storeCredentials(shop, token) {
    try {
      const storageKey = `${this.options.storagePrefix}credentials`;
      const tokenExpiry = Date.now() + this.options.tokenTTL;
      
      await this.browser.storage.local.set({
        [storageKey]: {
          shop,
          token,
          tokenExpiry,
          storedAt: new Date().toISOString()
        }
      });
      
      this.shop = shop;
      this.token = token;
      this.tokenExpiry = tokenExpiry;
      
      this._debug('Stored credentials for', shop);
    } catch (error) {
      this._debug('Error storing credentials:', error);
      throw error;
    }
  }
  
  /**
   * Clear stored credentials
   */
  async _clearStoredCredentials() {
    try {
      const storageKey = `${this.options.storagePrefix}credentials`;
      await this.browser.storage.local.remove(storageKey);
      
      this.shop = null;
      this.token = null;
      this.tokenExpiry = null;
      
      this._debug('Cleared stored credentials');
    } catch (error) {
      this._debug('Error clearing credentials:', error);
    }
  }
  
  /**
   * Authenticate with a Shopify store
   * @param {string} shop - The shop domain (e.g., 'store.myshopify.com')
   * @returns {Promise<Object>} Authentication result
   */
  async authenticate(shop) {
    // Validate shop domain
    if (!shop || !shop.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/)) {
      throw new Error('Invalid shop domain. Must be in format: store.myshopify.com');
    }
    
    // Check if already authenticated for this shop
    if (this.shop === shop && this.token && this.tokenExpiry > Date.now()) {
      this._debug('Already authenticated for', shop);
      return {
        success: true,
        shop: this.shop,
        token: this.token,
        cached: true
      };
    }
    
    // Prevent concurrent authentication attempts
    if (this.authInProgress) {
      throw new Error('Authentication already in progress');
    }
    
    this.authInProgress = true;
    
    try {
      // Request API key from worker
      const authResponse = await this._requestApiKey(shop);
      
      if (authResponse.api_key) {
        // Store the credentials
        await this._storeCredentials(shop, authResponse.api_key);
        
        return {
          success: true,
          shop: this.shop,
          token: this.token,
          cached: false
        };
      } else if (authResponse.error === 'App not installed') {
        // App not installed, need to go through OAuth
        return await this._performOAuthFlow(shop);
      } else {
        throw new Error(authResponse.error || 'Authentication failed');
      }
    } finally {
      this.authInProgress = false;
    }
  }
  
  /**
   * Request API key from worker
   */
  async _requestApiKey(shop) {
    try {
      const response = await fetch(`${this.workerUrl}/api/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ shop })
      });
      
      const data = await response.json();
      this._debug('API key request response:', data);
      
      return data;
    } catch (error) {
      this._debug('API key request error:', error);
      throw new Error(`Failed to request API key: ${error.message}`);
    }
  }
  
  /**
   * Perform OAuth flow for app installation
   */
  async _performOAuthFlow(shop) {
    this._debug('Starting OAuth flow for', shop);
    
    return new Promise((resolve, reject) => {
      const authUrl = `${this.workerUrl}/auth?shop=${encodeURIComponent(shop)}`;
      
      if (this.options.authMethod === 'popup') {
        // Popup-based OAuth (may be blocked by browsers)
        this._performPopupOAuth(authUrl, shop, resolve, reject);
      } else {
        // Tab-based OAuth (more reliable)
        this._performTabOAuth(authUrl, shop, resolve, reject);
      }
    });
  }
  
  /**
   * Perform OAuth in a new tab
   */
  async _performTabOAuth(authUrl, shop, resolve, reject) {
    // Create OAuth tab
    this.browser.tabs.create({ url: authUrl }, (tab) => {
      const tabId = tab.id;
      let resolved = false;
      
      // Set up listener for tab updates
      const listener = async (updatedTabId, _, updatedTab) => {
        if (updatedTabId !== tabId || resolved) return;
        
        // Check if redirected back to app in Shopify admin
        if (updatedTab.url && updatedTab.url.includes(`${shop}/admin/apps/`)) {
          resolved = true;
          
          // Close the tab
          this.browser.tabs.remove(tabId);
          this.browser.tabs.onUpdated.removeListener(listener);
          
          // Wait a moment for the installation to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Try to get API key again
          try {
            const authResponse = await this._requestApiKey(shop);
            
            if (authResponse.api_key) {
              await this._storeCredentials(shop, authResponse.api_key);
              resolve({
                success: true,
                shop: this.shop,
                token: this.token,
                cached: false
              });
            } else {
              reject(new Error('Failed to obtain API key after OAuth'));
            }
          } catch (error) {
            reject(error);
          }
        }
        
        // Check for explicit error pages
        if (updatedTab.url && updatedTab.url.includes('error=')) {
          resolved = true;
          this.browser.tabs.remove(tabId);
          this.browser.tabs.onUpdated.removeListener(listener);
          
          const urlParams = new URLSearchParams(new URL(updatedTab.url).search);
          const error = urlParams.get('error') || 'OAuth flow failed';
          reject(new Error(error));
        }
      };
      
      this.browser.tabs.onUpdated.addListener(listener);
      
      // Set timeout for OAuth flow
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.browser.tabs.onUpdated.removeListener(listener);
          reject(new Error('OAuth flow timed out'));
        }
      }, 120000); // 2 minutes timeout
    });
  }
  
  /**
   * Perform OAuth in a popup window (alternative method)
   */
  async _performPopupOAuth(authUrl, shop, resolve, reject) {
    // Note: This method may be blocked by popup blockers
    this.browser.windows.create({
      url: authUrl,
      type: 'popup',
      width: 600,
      height: 700
    }, (window) => {
      const windowId = window.id;
      let resolved = false;
      
      const listener = async (updatedWindowId) => {
        if (updatedWindowId !== windowId || resolved) return;
        
        // Check tabs in the window
        this.browser.tabs.query({ windowId }, async (tabs) => {
          const tab = tabs[0];
          if (!tab) return;
          
          if (tab.url && tab.url.includes(`${shop}/admin/apps/`)) {
            resolved = true;
            this.browser.windows.remove(windowId);
            
            // Wait for installation to complete
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            try {
              const authResponse = await this._requestApiKey(shop);
              if (authResponse.api_key) {
                await this._storeCredentials(shop, authResponse.api_key);
                resolve({
                  success: true,
                  shop: this.shop,
                  token: this.token,
                  cached: false
                });
              } else {
                reject(new Error('Failed to obtain API key after OAuth'));
              }
            } catch (error) {
              reject(error);
            }
          }
        });
      };
      
      this.browser.tabs.onUpdated.addListener(listener);
      
      // Cleanup on window close
      this.browser.windows.onRemoved.addListener((closedWindowId) => {
        if (closedWindowId === windowId && !resolved) {
          resolved = true;
          reject(new Error('OAuth window was closed by user'));
        }
      });
    });
  }
  
  /**
   * Make an authenticated API call to Shopify
   * @param {string} endpoint - The API endpoint (e.g., '/products.json')
   * @param {Object} options - Request options
   * @returns {Promise<Object>} API response
   */
  async api(endpoint, options = {}) {
    // Ensure authenticated
    if (!this.token) {
      if (!this.shop) {
        throw new Error('Not authenticated. Call authenticate() first.');
      }
      await this.authenticate(this.shop);
    }
    
    const { method = 'GET', data = null, retry = true } = options;
    let attempts = 0;
    
    while (attempts < this.options.retryAttempts) {
      attempts++;
      
      try {
        const response = await fetch(`${this.workerUrl}/api/proxy`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            endpoint,
            method,
            data
          })
        });
        
        const responseData = await response.json();
        
        // Handle authentication errors
        if (response.status === 401 && retry) {
          this._debug('Token expired, re-authenticating...');
          await this._clearStoredCredentials();
          await this.authenticate(this.shop);
          
          // Retry the request with new token
          return this.api(endpoint, { ...options, retry: false });
        }
        
        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After') || 2;
          this._debug(`Rate limited, retrying after ${retryAfter} seconds`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        
        // Handle other errors
        if (!response.ok) {
          throw new Error(responseData.error || `API request failed: ${response.status}`);
        }
        
        return responseData;
        
      } catch (error) {
        this._debug(`API request attempt ${attempts} failed:`, error);
        
        if (attempts >= this.options.retryAttempts) {
          throw error;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempts));
      }
    }
  }
  
  /**
   * Check if currently authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return !!(this.token && this.tokenExpiry > Date.now());
  }
  
  /**
   * Get current shop domain
   * @returns {string|null} Shop domain or null if not authenticated
   */
  getShop() {
    return this.shop;
  }
  
  /**
   * Get current token (for advanced use cases)
   * @returns {string|null} Current token or null
   */
  getToken() {
    if (this.isAuthenticated()) {
      return this.token;
    }
    return null;
  }
  
  /**
   * Logout and clear stored credentials
   */
  async logout() {
    await this._clearStoredCredentials();
    this._debug('Logged out successfully');
  }
  
  /**
   * Convenience method for GET requests
   */
  async get(endpoint) {
    return this.api(endpoint, { method: 'GET' });
  }
  
  /**
   * Convenience method for POST requests
   */
  async post(endpoint, data) {
    return this.api(endpoint, { method: 'POST', data });
  }
  
  /**
   * Convenience method for PUT requests
   */
  async put(endpoint, data) {
    return this.api(endpoint, { method: 'PUT', data });
  }
  
  /**
   * Convenience method for DELETE requests
   */
  async delete(endpoint) {
    return this.api(endpoint, { method: 'DELETE' });
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ShopifyAuthClient;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return ShopifyAuthClient; });
} else {
  window.ShopifyAuthClient = ShopifyAuthClient;
}