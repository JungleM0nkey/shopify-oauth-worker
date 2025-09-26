// Storefront OAuth Gateway - Main Worker File
// Modular architecture for better maintainability

import { validateEnvironment } from './lib/validation.js';
import { getCorsHeaders } from './lib/utils.js';
import { routeRequest } from './lib/handlers.js';
import { handleError } from './lib/error-handler.js';
import { createRateLimitMiddleware, createRateLimitResponse, checkDDoSProtection } from './lib/rate-limiter.js';

// Main Worker Export
export default {
  async fetch(request, env, ctx) {
    try {
      // Validate environment configuration
      validateEnvironment(env);
      
      const url = new URL(request.url);
      
      // DDoS protection check
      const ddosCheck = checkDDoSProtection(request);
      if (ddosCheck.blocked) {
        return createRateLimitResponse(ddosCheck.retryAfter || 60, getCorsHeaders());
      }
      
      // CORS headers for extension support
      const corsHeaders = getCorsHeaders();
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      
      // Apply rate limiting based on endpoint type
      let rateLimitType = 'api';
      if (url.pathname.startsWith('/auth')) {
        rateLimitType = 'auth';
      } else if (url.pathname.startsWith('/webhooks')) {
        rateLimitType = 'webhook';
      } else if (url.pathname.startsWith('/health') || url.pathname === '/status' || url.pathname === '/metrics') {
        rateLimitType = 'health';
      }
      
      const rateLimitCheck = createRateLimitMiddleware(rateLimitType)(request);
      if (!rateLimitCheck.allowed) {
        return createRateLimitResponse(rateLimitCheck.retryAfter, corsHeaders);
      }
      
      // Route request to appropriate handler
      const response = await routeRequest(request, url, env, corsHeaders);
      
      // Add rate limit headers to response
      if (response.headers) {
        Object.entries(rateLimitCheck.headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      }
      
      return response;
      
    } catch (error) {
      return handleError(error);
    }
  },
};