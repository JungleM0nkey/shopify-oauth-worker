import { APP_NAME, ERROR_MESSAGES } from '../utils/constants.js';

// Create Installation Redirect
export function createInstallRedirect(shop, env) {
  const installUrl = `/auth?shop=${encodeURIComponent(shop)}`;
  const fullUrl = new URL(installUrl, env.APP_URL);
  return Response.redirect(fullUrl.toString(), 302);
}

// Create Access Denied Page
export function createAccessDeniedPage(shop) {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${ERROR_MESSAGES.ACCESS_DENIED_TITLE}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 600px;
          margin: 50px auto;
          padding: 2rem;
          text-align: center;
        }
        .error-container {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          border-radius: 8px;
          padding: 2rem;
        }
        h1 { color: #856404; }
        p { color: #856404; margin: 1rem 0; }
        .shop-name { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>${ERROR_MESSAGES.ACCESS_DENIED_TITLE}</h1>
        <p>${ERROR_MESSAGES.ACCESS_DENIED_MESSAGE}</p>
        <p>Shop: <span class="shop-name">${shop}</span></p>
        <a href="https://${shop}/admin/apps">Return to Shopify Admin</a>
      </div>
    </body>
    </html>
  `,
    {
      headers: { 'Content-Type': 'text/html' },
      status: 403,
    },
  );
}

// Create Embedded App Interface
export function createEmbeddedApp(shop, host, env) {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${APP_NAME} - ${shop}</title>
      <script src="https://unpkg.com/@shopify/app-bridge@3"></script>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 2rem;
          background: #f8f9fa;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
        }
        .card {
          background: white;
          border-radius: 8px;
          padding: 2rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        h1 {
          color: #008060;
          margin: 0 0 1rem 0;
        }
        h2 {
          color: #637381;
          font-size: 1.25rem;
          margin: 0 0 1rem 0;
        }
        p {
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
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #e1e3e5;
        }
        .info-item:last-child {
          border-bottom: none;
        }
        .info-item strong {
          color: #637381;
        }
        .info-item span {
          color: #212529;
          font-weight: 500;
        }
        ol {
          padding-left: 2rem;
        }
        ol li {
          margin: 0.5rem 0;
          color: #5c5f62;
        }
        ul {
          list-style: none;
          padding: 0;
        }
        ul li {
          margin: 0.5rem 0;
        }
        ul li a {
          display: inline-block;
          padding: 0.5rem 1rem;
          background: #008060;
          color: white !important;
          border-radius: 4px;
          text-decoration: none;
        }
        ul li a:hover {
          background: #006e52;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card">
          <h1>${APP_NAME}</h1>
          <p>Successfully connected to <strong>${shop}</strong>!</p>
          
          <div class="info-grid">
            <div class="info-item">
              <strong>Shop Domain</strong>
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
          
          // Handle App Bridge actions
          console.log('App Bridge initialized for embedded app');
        </script>
      </div>
    </body>
    </html>
  `,
    {
      headers: { 'Content-Type': 'text/html' },
    },
  );
}

// Create Landing Page
export function createLandingPage() {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${APP_NAME}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          max-width: 1000px;
          margin: 0 auto;
          padding: 2rem;
        }
        .hero {
          text-align: center;
          color: white;
          margin-bottom: 3rem;
        }
        h1 {
          font-size: 3rem;
          margin-bottom: 1rem;
          font-weight: 300;
        }
        .subtitle {
          font-size: 1.25rem;
          opacity: 0.9;
          margin-bottom: 2rem;
        }
        .cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
          margin-top: 2rem;
        }
        .card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .card h2 {
          color: #333;
          margin-bottom: 1rem;
          font-size: 1.5rem;
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
        .feature h3 {
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }
        .feature p {
          color: #666;
          font-size: 0.9rem;
          margin: 0;
        }
        code {
          background: #f1f2f3;
          padding: 0.25rem 0.5rem;
          border-radius: 3px;
          font-family: 'SF Mono', Monaco, monospace;
          font-size: 0.875rem;
          color: #d72b3f;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="hero">
          <h1>${APP_NAME}</h1>
          <p class="subtitle">Secure OAuth authentication and API gateway for browser extensions</p>
        </div>
        
        <div class="card" style="text-align: center; margin-bottom: 2rem;">
          <h2>Get Started</h2>
          <p>This OAuth gateway enables browser extensions to securely connect with Shopify stores. Install the app in your Shopify admin to begin.</p>
          
          <div class="features">
            <div class="feature">
              <span class="feature-icon">🔐</span>
              <div class="feature-text">
                <h3>Secure OAuth</h3>
                <p>Industry-standard authentication</p>
              </div>
            </div>
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
        
        <div class="cards" style="margin-top: 2rem;">
          <div class="card">
            <h2>For Store Owners</h2>
            <p>Install this app to enable secure browser extension access to your Shopify store data.</p>
            <a href="https://apps.shopify.com/your-app-handle" class="button">Install from App Store</a>
          </div>
          
          <div class="card">
            <h2>For Developers</h2>
            <p>Use our OAuth gateway to build browser extensions that integrate with Shopify stores.</p>
            <a href="https://github.com/your-org/extension-client" class="button">Get Extension SDK</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `,
    {
      headers: { 'Content-Type': 'text/html' },
    },
  );
}
