// Storefront OAuth Gateway - Main Worker File
// Modular architecture for better maintainability

import { validateEnvironment } from './lib/validation.js';
import { getCorsHeaders } from './lib/utils.js';
import { routeRequest } from './lib/handlers.js';
import { handleError } from './lib/error-handler.js';
import { rateLimitByIP } from './lib/rate-limit.js';

// Main Worker Export
export default {
  async fetch(request, env, ctx) {
    try {
      // Validate environment configuration
      validateEnvironment(env);
      
      const url = new URL(request.url);
      
      // Basic rate limiting by IP for all requests
      const ipRateLimit = await rateLimitByIP(request, env);
      if (ipRateLimit) return ipRateLimit;
      
      // CORS headers for extension support with origin validation
      const origin = request.headers.get('origin');
      const corsHeaders = getCorsHeaders(env, origin);
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          headers: {
            ...corsHeaders,
            'Access-Control-Max-Age': '86400'
          }
        });
      }
      
      // Route request to appropriate handler
      return await routeRequest(request, url, env, corsHeaders);
      
    } catch (error) {
      return handleError(error);
    }
  },
};