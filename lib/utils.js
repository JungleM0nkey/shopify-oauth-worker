// Utility Functions

// CORS Headers with configurable origins
export function getCorsHeaders(env, origin = null) {
  // Get allowed origins from environment or use defaults
  const allowedOrigins = env?.ALLOWED_ORIGINS 
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['https://admin.shopify.com', 'https://*.myshopify.com'];
  
  let allowOrigin = '*'; // Fallback
  
  if (origin) {
    // Check if origin is in allowlist
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === '*') return true;
      if (allowed.includes('*')) {
        // Handle wildcard patterns like *.myshopify.com
        const pattern = allowed.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(origin);
      }
      return allowed === origin;
    });
    
    allowOrigin = isAllowed ? origin : 'null';
  }
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // 24 hours
  };
}

// Security Headers for HTML responses
export function getSecurityHeaders(env) {
  const nonce = crypto.randomUUID();
  
  return {
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${nonce}' https://unpkg.com https://cdn.shopify.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.myshopify.com; frame-ancestors 'self' https://admin.shopify.com https://*.myshopify.com;`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
    'X-Nonce': nonce
  };
}

// Extract API Key from Authorization Header
export function extractApiKey(request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Parse JSON Body with Error Handling and Size Limits
export async function parseJsonBody(request, maxSize = 1024 * 1024) { // 1MB default
  try {
    // Check content length
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > maxSize) {
      throw new Error('Request body too large');
    }
    
    const body = await request.json();
    
    // Additional size check after parsing
    const bodySize = JSON.stringify(body).length;
    if (bodySize > maxSize) {
      throw new Error('Request body too large');
    }
    
    return body;
  } catch (error) {
    if (error.message.includes('too large')) {
      throw error;
    }
    return {};
  }
}

// Sanitize string input
export function sanitizeString(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters and limit length
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>\"'&]/g, '') // Remove remaining HTML/script chars
    .replace(/[\x00-\x1f\x7f-\x9f]/g, '') // Remove control chars
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .trim()
    .substring(0, maxLength);
}

// Validate and sanitize shop domain
export function validateAndSanitizeShop(shop) {
  if (!shop || typeof shop !== 'string') return null;
  
  const sanitized = sanitizeString(shop, 100).toLowerCase();
  
  // Strict validation for shop domains
  if (!/^[a-z0-9][a-z0-9-]{0,60}\.myshopify\.com$/.test(sanitized)) {
    return null;
  }
  
  return sanitized;
}

// Validate API endpoint paths
export function validateEndpoint(endpoint) {
  if (!endpoint || typeof endpoint !== 'string') return false;
  
  const sanitized = sanitizeString(endpoint, 200);
  
  // Must start with / and contain only safe characters
  if (!/^\/[a-zA-Z0-9\/_.-]*\.json$/.test(sanitized)) {
    return false;
  }
  
  // Disallow certain dangerous paths
  const disallowedPaths = [
    '/admin/api/',
    '/webhooks/',
    '/auth/',
    '../',
    '..',
  ];
  
  return !disallowedPaths.some(path => sanitized.includes(path));
}

// Validate HTTP method
export function validateHttpMethod(method) {
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
  return allowedMethods.includes(method?.toUpperCase());
}

// Create JSON Response with security headers
export function createJsonResponse(data, status, headers = {}) {
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  };
  
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...securityHeaders,
      ...headers,
    },
  });
}

// Create HTML Response with full security headers
export function createHtmlResponse(html, status = 200, additionalHeaders = {}) {
  const securityHeaders = getSecurityHeaders();
  
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders,
      ...additionalHeaders,
    },
  });
}

// Build Shopify Auth URL with validation
export function buildShopifyAuthUrl(shop, clientId, scope, redirectUri, state) {
  // Validate all parameters
  const validatedShop = validateAndSanitizeShop(shop);
  if (!validatedShop) {
    throw new Error('Invalid shop domain');
  }
  
  if (!clientId || typeof clientId !== 'string' || clientId.length > 100) {
    throw new Error('Invalid client ID');
  }
  
  if (!scope || typeof scope !== 'string' || scope.length > 500) {
    throw new Error('Invalid scope');
  }
  
  if (!redirectUri || typeof redirectUri !== 'string' || !redirectUri.startsWith('https://')) {
    throw new Error('Invalid redirect URI');
  }
  
  if (!state || typeof state !== 'string' || state.length > 100) {
    throw new Error('Invalid state parameter');
  }
  
  const params = new URLSearchParams({
    client_id: sanitizeString(clientId, 100),
    scope: sanitizeString(scope, 500),
    redirect_uri: redirectUri,
    state: sanitizeString(state, 100),
  });
  
  return `https://${validatedShop}/admin/oauth/authorize?${params}`;
}