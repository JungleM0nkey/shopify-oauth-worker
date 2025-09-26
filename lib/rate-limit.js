// Rate Limiting Module

// Rate limiting configuration
const RATE_LIMITS = {
  // Per API key limits (requests per minute)
  API_KEY: {
    requests: 100,
    window: 60 * 1000, // 1 minute
  },
  // Per shop limits (requests per minute)
  SHOP: {
    requests: 50,
    window: 60 * 1000, // 1 minute
  },
  // Per IP limits (requests per minute) - for unauthenticated requests
  IP: {
    requests: 20,
    window: 60 * 1000, // 1 minute
  },
  // Auth endpoint specific limits (attempts per hour)
  AUTH: {
    requests: 10,
    window: 60 * 60 * 1000, // 1 hour
  }
};

// Extract client IP from request
function getClientIP(request) {
  // Check Cloudflare headers first
  const cfConnectingIp = request.headers.get('CF-Connecting-IP');
  if (cfConnectingIp) return cfConnectingIp;
  
  // Fallback to other headers
  const xForwardedFor = request.headers.get('X-Forwarded-For');
  if (xForwardedFor) {
    return xForwardedFor.split(',')[0].trim();
  }
  
  const xRealIp = request.headers.get('X-Real-IP');
  if (xRealIp) return xRealIp;
  
  return 'unknown';
}

// Create rate limit key
function createRateLimitKey(type, identifier) {
  return `rate_limit:${type}:${identifier}`;
}

// Check rate limit for a given key
export async function checkRateLimit(env, type, identifier, config = null) {
  try {
    const limit = config || RATE_LIMITS[type];
    if (!limit) {
      console.warn(`Unknown rate limit type: ${type}`);
      return { allowed: true, remaining: limit?.requests || 100 };
    }

    const key = createRateLimitKey(type, identifier);
    const now = Date.now();
    const windowStart = now - limit.window;
    
    // Get current rate limit data
    const rateLimitData = await env.API_KEYS.get(key, 'json') || {
      requests: [],
      windowStart: now
    };
    
    // Clean old requests outside the window
    rateLimitData.requests = rateLimitData.requests.filter(
      timestamp => timestamp > windowStart
    );
    
    // Check if limit exceeded
    if (rateLimitData.requests.length >= limit.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.min(...rateLimitData.requests) + limit.window
      };
    }
    
    // Add current request
    rateLimitData.requests.push(now);
    
    // Store updated rate limit data with TTL
    await env.API_KEYS.put(
      key,
      JSON.stringify(rateLimitData),
      { expirationTtl: Math.ceil(limit.window / 1000) + 60 } // Add buffer
    );
    
    return {
      allowed: true,
      remaining: limit.requests - rateLimitData.requests.length
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Fail open - allow request if rate limiting fails
    return { allowed: true, remaining: 100 };
  }
}

// Rate limit middleware for API endpoints
export async function rateLimitMiddleware(request, env, type, identifier) {
  const result = await checkRateLimit(env, type, identifier);
  
  if (!result.allowed) {
    const resetTime = new Date(result.resetTime).toISOString();
    return new Response(
      JSON.stringify({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again after ${resetTime}`,
        resetTime: resetTime
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': RATE_LIMITS[type]?.requests.toString() || '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime
        }
      }
    );
  }
  
  return null; // No rate limit hit, continue
}

// Rate limit by API key
export async function rateLimitByApiKey(request, env, apiKey) {
  return rateLimitMiddleware(request, env, 'API_KEY', apiKey);
}

// Rate limit by shop
export async function rateLimitByShop(request, env, shop) {
  return rateLimitMiddleware(request, env, 'SHOP', shop);
}

// Rate limit by IP
export async function rateLimitByIP(request, env) {
  const clientIP = getClientIP(request);
  return rateLimitMiddleware(request, env, 'IP', clientIP);
}

// Rate limit for auth endpoints
export async function rateLimitAuth(request, env, identifier) {
  return rateLimitMiddleware(request, env, 'AUTH', identifier);
}

// Add rate limit headers to response
export function addRateLimitHeaders(response, type, remaining = null) {
  const limit = RATE_LIMITS[type];
  if (!limit || !response) return response;
  
  const headers = new Headers(response.headers);
  headers.set('X-RateLimit-Limit', limit.requests.toString());
  if (remaining !== null) {
    headers.set('X-RateLimit-Remaining', remaining.toString());
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}