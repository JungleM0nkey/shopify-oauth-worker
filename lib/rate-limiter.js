// Rate Limiting Module for Production Security
// Implements token bucket and sliding window rate limiting

// In-memory rate limiting cache (for single instance)
const rateLimitCache = new Map();

// Rate limit configurations
const RATE_LIMITS = {
  // General API requests per minute
  api: { requests: 100, window: 60 * 1000 },
  // Authentication requests per hour
  auth: { requests: 20, window: 60 * 60 * 1000 },
  // Webhook processing per minute
  webhook: { requests: 1000, window: 60 * 1000 },
  // Health checks per minute
  health: { requests: 60, window: 60 * 1000 },
};

// Rate limiter class using sliding window
export class RateLimiter {
  constructor() {
    // Cleanup old entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  // Check if request is within rate limit
  checkRateLimit(key, type = 'api', identifier = null) {
    const config = RATE_LIMITS[type] || RATE_LIMITS.api;
    const now = Date.now();
    const windowStart = now - config.window;
    
    // Create unique key with identifier if provided
    const cacheKey = identifier ? `${type}:${identifier}:${key}` : `${type}:${key}`;
    
    if (!rateLimitCache.has(cacheKey)) {
      rateLimitCache.set(cacheKey, []);
    }
    
    const requests = rateLimitCache.get(cacheKey);
    
    // Remove requests outside the current window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if under limit
    if (validRequests.length >= config.requests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.min(...validRequests) + config.window,
        limit: config.requests,
      };
    }
    
    // Add current request
    validRequests.push(now);
    rateLimitCache.set(cacheKey, validRequests);
    
    return {
      allowed: true,
      remaining: config.requests - validRequests.length,
      resetTime: now + config.window,
      limit: config.requests,
    };
  }

  // Cleanup old entries
  cleanup() {
    const now = Date.now();
    const maxWindow = Math.max(...Object.values(RATE_LIMITS).map(r => r.window));
    
    for (const [key, requests] of rateLimitCache.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > now - maxWindow);
      if (validRequests.length === 0) {
        rateLimitCache.delete(key);
      } else {
        rateLimitCache.set(key, validRequests);
      }
    }
  }

  // Get rate limit status without incrementing
  getRateLimitStatus(key, type = 'api', identifier = null) {
    const config = RATE_LIMITS[type] || RATE_LIMITS.api;
    const now = Date.now();
    const windowStart = now - config.window;
    
    const cacheKey = identifier ? `${type}:${identifier}:${key}` : `${type}:${key}`;
    const requests = rateLimitCache.get(cacheKey) || [];
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return {
      remaining: config.requests - validRequests.length,
      limit: config.requests,
      used: validRequests.length,
    };
  }
}

// Singleton instance
let rateLimiter = null;

export function getRateLimiter() {
  if (!rateLimiter) {
    rateLimiter = new RateLimiter();
  }
  return rateLimiter;
}

// Middleware function to check rate limits
export function createRateLimitMiddleware(type = 'api') {
  return (request) => {
    const limiter = getRateLimiter();
    
    // Get identifier from request (IP, user agent, etc.)
    const ip = request.headers.get('CF-Connecting-IP') || 
              request.headers.get('X-Forwarded-For') || 
              'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    const identifier = `${ip}`;
    
    const result = limiter.checkRateLimit(identifier, type, null);
    
    return {
      allowed: result.allowed,
      headers: {
        'X-RateLimit-Limit': result.limit.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
      },
      retryAfter: result.allowed ? null : Math.ceil((result.resetTime - Date.now()) / 1000),
    };
  };
}

// Check rate limit for API key
export function checkAPIKeyRateLimit(apiKey, type = 'api') {
  const limiter = getRateLimiter();
  return limiter.checkRateLimit(apiKey, type, 'apikey');
}

// DDoS protection - more aggressive rate limiting
export function checkDDoSProtection(request) {
  const limiter = getRateLimiter();
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  // Very strict limits for DDoS protection
  const result = limiter.checkRateLimit(ip, 'api', 'ddos');
  
  // Additional checks for suspicious patterns
  const userAgent = request.headers.get('User-Agent') || '';
  const isSuspicious = 
    !userAgent ||
    userAgent.includes('bot') ||
    userAgent.includes('crawler') ||
    userAgent.length < 10;
  
  if (isSuspicious && !result.allowed) {
    return {
      blocked: true,
      reason: 'Suspicious activity detected',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    };
  }
  
  return {
    blocked: !result.allowed,
    reason: result.allowed ? null : 'Rate limit exceeded',
    retryAfter: result.allowed ? null : Math.ceil((result.resetTime - Date.now()) / 1000),
  };
}

// Rate limit response helper
export function createRateLimitResponse(retryAfter, corsHeaders = {}) {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retry_after: retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        ...corsHeaders,
      },
    }
  );
}