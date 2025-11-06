// Rate Limiting Utility

// Default rate limit configuration
const DEFAULT_RATE_LIMIT = {
  maxRequests: 100, // Max requests per window
  windowSeconds: 60, // Time window in seconds
};

// Check rate limit for a given key (e.g., API key, IP address)
export async function checkRateLimit(key, env, config = DEFAULT_RATE_LIMIT) {
  const { maxRequests, windowSeconds } = config;

  // Create a rate limit key with current time window
  const currentWindow = Math.floor(Date.now() / 1000 / windowSeconds);
  const rateLimitKey = `ratelimit:${key}:${currentWindow}`;

  try {
    // Get current request count
    const currentCount = await env.API_KEYS.get(rateLimitKey);
    const count = currentCount ? parseInt(currentCount, 10) : 0;

    // Check if limit exceeded
    if (count >= maxRequests) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        resetAt: (currentWindow + 1) * windowSeconds,
      };
    }

    // Increment counter
    const newCount = count + 1;
    await env.API_KEYS.put(rateLimitKey, newCount.toString(), {
      expirationTtl: windowSeconds * 2, // Keep for 2 windows for safety
    });

    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests - newCount,
      resetAt: (currentWindow + 1) * windowSeconds,
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // On error, allow the request but log the failure
    return {
      allowed: true,
      limit: maxRequests,
      remaining: maxRequests,
      resetAt: (currentWindow + 1) * windowSeconds,
    };
  }
}

// Add rate limit headers to response
export function addRateLimitHeaders(headers, rateLimit) {
  return {
    ...headers,
    'X-RateLimit-Limit': rateLimit.limit.toString(),
    'X-RateLimit-Remaining': rateLimit.remaining.toString(),
    'X-RateLimit-Reset': rateLimit.resetAt.toString(),
  };
}

// Create rate limit exceeded response
export function createRateLimitResponse(rateLimit, corsHeaders = {}) {
  const retryAfter = rateLimit.resetAt - Math.floor(Date.now() / 1000);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please try again in ${retryAfter} seconds.`,
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString(),
        ...addRateLimitHeaders(corsHeaders, rateLimit),
      },
    },
  );
}
