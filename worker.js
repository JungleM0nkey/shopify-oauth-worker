// Storefront OAuth Gateway - Main Worker File
// Modular architecture for better maintainability

import { validateEnvironment } from './lib/validation.js';
import { getCorsHeaders } from './lib/utils.js';
import { routeRequest } from './lib/handlers.js';
import { handleError } from './lib/error-handler.js';

// Main Worker Export
export default {
  async fetch(request, env, ctx) {
    try {
      // Validate environment configuration
      validateEnvironment(env);
      
      const url = new URL(request.url);
      
      // CORS headers for extension support
      const corsHeaders = getCorsHeaders();
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
      
      // Route request to appropriate handler
      return await routeRequest(request, url, env, corsHeaders);
      
    } catch (error) {
      return handleError(error);
    }
  },
};