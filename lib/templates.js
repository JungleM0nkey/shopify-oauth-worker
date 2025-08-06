import { APP_NAME, ERROR_MESSAGES } from './constants.js';

// Create Installation Redirect
export function createInstallRedirect(shop, env) {
  const installUrl = `/auth?shop=${encodeURIComponent(shop)}`;
  const fullUrl = new URL(installUrl, env.APP_URL);
  return Response.redirect(fullUrl.toString(), 302);
}

// Create Access Denied Page
export function createAccessDeniedPage(shop) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${ERROR_MESSAGES.ACCESS_DENIED_TITLE}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: #f4f4f5;
        }
        .error-container {
          text-align: center;
          padding: 2rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          max-width: 500px;
        }
        h1 { 
          color: #d72c0d;
          margin-bottom: 1rem;
        }
        p { 
          color: #666;
          margin: 1rem 0;
          line-height: 1.5;
        }
        .button {
          display: inline-block;
          background: #008060;
          color: white;
          padding: 0.75rem 1.5rem;
          text-decoration: none;
          border-radius: 4px;
          margin-top: 1rem;
          transition: background 0.2s;
        }
        .button:hover {
          background: #006e52;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>⚠️ ${ERROR_MESSAGES.ACCESS_DENIED_TITLE}</h1>
        <p>${ERROR_MESSAGES.ACCESS_DENIED_MESSAGE}</p>
        <p>Please access this app through your Shopify admin panel:</p>
        <a href="https://${shop}/admin/apps" class="button">Go to Shopify Admin</a>
      </div>
    </body>
    </html>
  `;
  
  return new Response(html, {
    status: 403,
    headers: { 'Content-Type': 'text/html' },
  });
}

// Create Embedded App Interface
export function createEmbeddedApp(shop, host, env) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${APP_NAME}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 2rem;
          max-width: 900px;
          margin: 0 auto;
          background: #f6f6f7;
        }
        .header {
          margin-bottom: 2rem;
        }
        h1 {
          color: #202223;
          font-size: 1.75rem;
          margin: 0 0 0.5rem 0;
        }
        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.75rem;
          background: #e3f2e3;
          color: #008060;
          border-radius: 4px;
          font-weight: 500;
          font-size: 0.875rem;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }
        .card h2 {
          color: #202223;
          font-size: 1.25rem;
          margin: 0 0 1rem 0;
        }
        .card p {
          color: #5c5f62;
          line-height: 1.6;
          margin: 0.75rem 0;
        }
        ol, ul {
          color: #5c5f62;
          line-height: 1.8;
          margin: 1rem 0;
          padding-left: 1.5rem;
        }
        code {
          background: #f1f2f3;
          padding: 0.25rem 0.5rem;
          border-radius: 3px;
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 0.875rem;
          color: #d72b3f;
        }
        a {
          color: #008060;
          text-decoration: none;
          transition: color 0.2s;
        }
        a:hover {
          color: #006e52;
          text-decoration: underline;
        }
        .info-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-top: 1rem;
        }
        .info-item {
          padding: 0.75rem;
          background: #f6f6f7;
          border-radius: 4px;
        }
        .info-item strong {
          color: #202223;
          display: block;
          margin-bottom: 0.25rem;
        }
        .info-item span {
          color: #5c5f62;
          font-size: 0.875rem;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${APP_NAME}</h1>
        <span class="status-badge">✓ Active</span>
      </div>
      
      <div class="card">
        <h2>About</h2>
        <p>This app provides secure API access for browser extensions to connect to your storefront. It acts as a bridge between your browser extensions and Shopify's API.</p>
        <div class="info-grid">
          <div class="info-item">
            <strong>Store</strong>
            <span>${shop}</span>
          </div>
          <div class="info-item">
            <strong>API Version</strong>
            <span>${env.SHOPIFY_API_VERSION}</span>
          </div>
          <div class="info-item">
            <strong>Permissions</strong>
            <span>${env.OAUTH_SCOPES.replace(/,/g, ', ')}</span>
          </div>
        </div>
      </div>
      
      <div class="card">
        <h2>How to Connect Your Extension</h2>
        <ol>
          <li>Install the browser extension from the official store</li>
          <li>Click the extension icon in your browser toolbar</li>
          <li>Enter your shop domain: <code>${shop}</code></li>
          <li>Click "Connect" and follow the authorization flow</li>
          <li>Your extension will receive an API key for secure access</li>
        </ol>
      </div>
      
      <div class="card">
        <h2>Available Extensions</h2>
        <ul>
          <li><a href="https://chrome.google.com/webstore/detail/your-extension" target="_blank">Chrome Extension →</a></li>
          <li><a href="https://addons.mozilla.org/addon/your-extension" target="_blank">Firefox Add-on →</a></li>
        </ul>
      </div>
      
      <div class="card">
        <h2>Security</h2>
        <p>This app uses OAuth 2.0 for secure authentication and generates unique API keys for each extension connection. All data is transmitted over HTTPS and access tokens are securely stored.</p>
      </div>
      
      <script>
        // Initialize App Bridge for embedded context
        const AppBridge = window['app-bridge'];
        const createApp = AppBridge.default;
        const app = createApp({
          apiKey: '${env.SHOPIFY_API_KEY}',
          host: '${host}',
        });
        
        // Optional: Add App Bridge features
        const TitleBar = AppBridge.actions.TitleBar;
        const titleBarOptions = {
          title: '${APP_NAME}',
        };
        const myTitleBar = TitleBar.create(app, titleBarOptions);
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Security-Policy': "frame-ancestors https://*.myshopify.com https://admin.shopify.com",
    },
  });
}

// Create Landing Page
export function createLandingPage() {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${APP_NAME}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * {
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }
        .hero {
          text-align: center;
          padding: 4rem 2rem;
          color: white;
        }
        h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }
        .subtitle {
          font-size: 1.25rem;
          opacity: 0.95;
          margin-bottom: 2rem;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-top: 3rem;
        }
        .card {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
        }
        .card h2 {
          color: #333;
          margin-bottom: 1rem;
        }
        .card p {
          color: #666;
          margin-bottom: 1.5rem;
        }
        .button {
          display: inline-block;
          background: #008060;
          color: white;
          padding: 0.75rem 1.5rem;
          text-decoration: none;
          border-radius: 6px;
          transition: all 0.3s;
          font-weight: 500;
        }
        .button:hover {
          background: #006e52;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0,134,96,0.3);
        }
        .button-secondary {
          background: #764ba2;
        }
        .button-secondary:hover {
          background: #5f3989;
        }
        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-top: 1rem;
        }
        .feature {
          display: flex;
          align-items: start;
          gap: 1rem;
        }
        .feature-icon {
          font-size: 1.5rem;
        }
        .feature-text {
          flex: 1;
        }
        .feature-text h3 {
          margin: 0 0 0.5rem 0;
          color: #333;
        }
        .feature-text p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="hero">
          <h1>${APP_NAME}</h1>
          <p class="subtitle">Connect browser extensions to Shopify stores securely</p>
        </div>
        
        <div class="cards">
          <div class="card">
            <h2>🏪 For Store Owners</h2>
            <p>Enable secure browser extension access to your Shopify store. Manage products, orders, and more directly from your browser.</p>
            <div class="features">
              <div class="feature">
                <span class="feature-icon">🔐</span>
                <div class="feature-text">
                  <h3>Secure OAuth</h3>
                  <p>Industry-standard authentication</p>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">⚡</span>
                <div class="feature-text">
                  <h3>Fast Access</h3>
                  <p>Quick API responses</p>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">🛡️</span>
                <div class="feature-text">
                  <h3>GDPR Compliant</h3>
                  <p>Full data protection</p>
                </div>
              </div>
            </div>
            <br>
            <a href="https://apps.shopify.com/extension-gateway" class="button">View on App Store</a>
          </div>
          
          <div class="card">
            <h2>🔧 For Developers</h2>
            <p>Build powerful browser extensions that integrate seamlessly with Shopify stores using our secure gateway.</p>
            <div class="features">
              <div class="feature">
                <span class="feature-icon">📦</span>
                <div class="feature-text">
                  <h3>Full API Access</h3>
                  <p>Products, orders, customers</p>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">🔑</span>
                <div class="feature-text">
                  <h3>API Keys</h3>
                  <p>Secure token management</p>
                </div>
              </div>
              <div class="feature">
                <span class="feature-icon">🌐</span>
                <div class="feature-text">
                  <h3>CORS Support</h3>
                  <p>Browser-friendly endpoints</p>
                </div>
              </div>
            </div>
            <br>
            <a href="https://github.com/your-org/extension-gateway" class="button button-secondary">View Documentation</a>
          </div>
        </div>
        
        <div class="cards" style="margin-top: 2rem;">
          <div class="card" style="grid-column: 1 / -1;">
            <h2>📱 Get the Extensions</h2>
            <p>Install our official browser extensions to start managing your Shopify store more efficiently:</p>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top: 1.5rem;">
              <a href="https://chrome.google.com/webstore/detail/your-extension" class="button">Chrome Extension</a>
              <a href="https://addons.mozilla.org/addon/your-extension" class="button">Firefox Add-on</a>
              <a href="https://microsoftedge.microsoft.com/addons/detail/your-extension" class="button">Edge Add-on</a>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}