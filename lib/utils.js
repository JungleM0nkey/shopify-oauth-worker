// Utility Functions

// CORS Headers with Security Hardening
export function getCorsHeaders(origin = null, env = null) {
  // Production-ready CORS configuration
  const allowedOrigins = env?.ALLOWED_ORIGINS 
    ? env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'https://localhost:3000']; // Default for development

  let allowOrigin = '*'; // Fallback for development
  
  if (env?.NODE_ENV === 'production' && origin) {
    // In production, only allow specific origins
    allowOrigin = allowedOrigins.includes(origin) ? origin : 'null';
  } else if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// Security Headers for Production
export function getSecurityHeaders(env = null) {
  const cspPolicy = env?.CSP_POLICY || "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.shopify.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.myshopify.com; frame-ancestors https://*.myshopify.com https://admin.shopify.com;";
  
  return {
    'Content-Security-Policy': cspPolicy,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN', // Allow framing from Shopify admin
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
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

// Parse JSON Body with Error Handling
export async function parseJsonBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// Rate Limiting Implementation
export async function checkRateLimit(ip, endpoint, env, maxRequests = 100, windowSeconds = 60) {
  if (!env.RATE_LIMIT) return true; // Skip if rate limiting KV namespace not configured
  
  const key = `rate:${ip}:${endpoint}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  try {
    // Get current request data
    const data = await env.RATE_LIMIT.get(key, 'json') || { requests: [], window: now };
    
    // Filter requests within the current window
    const validRequests = data.requests.filter(timestamp => timestamp > windowStart);
    
    // Check if rate limit exceeded
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request and update
    validRequests.push(now);
    await env.RATE_LIMIT.put(key, JSON.stringify({
      requests: validRequests,
      window: now
    }), { expirationTtl: windowSeconds * 2 }); // TTL longer than window for cleanup
    
    return true;
  } catch (error) {
    console.error('Rate limiting error:', error);
    return true; // Allow request if rate limiting fails
  }
}

// Input Validation and Sanitization
export function sanitizeInput(input, type = 'string') {
  if (input === null || input === undefined) {
    return '';
  }
  
  switch (type) {
    case 'shop':
      // Shop domain validation and sanitization
      return String(input).toLowerCase().replace(/[^a-z0-9.-]/g, '').substring(0, 100);
    case 'endpoint':
      // API endpoint sanitization
      return String(input).replace(/[^a-zA-Z0-9/_.-]/g, '').substring(0, 200);
    case 'string':
    default:
      // Basic string sanitization
      return String(input).replace(/[<>'"&]/g, '').substring(0, 500);
  }
}

// Enhanced JSON Response with Security Headers
export function createJsonResponse(data, status, corsHeaders = {}, securityHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...securityHeaders,
    },
  });
}

// Build Shopify Auth URL
export function buildShopifyAuthUrl(shop, clientId, scope, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scope,
    redirect_uri: redirectUri,
    state: state,
  });
  return `https://${shop}/admin/oauth/authorize?${params}`;
}