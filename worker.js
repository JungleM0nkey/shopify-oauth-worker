// Storefront OAuth Gateway - Main Worker File
// Modular architecture for better maintainability

import { validateEnvironment } from './lib/validation.js';
import { getCorsHeaders, getSecurityHeaders } from './lib/utils.js';
import { routeRequest } from './lib/handlers.js';
import { handleError } from './lib/error-handler.js';

// Main Worker Export
export default {
  async fetch(request, env, ctx) {
    try {
      // Validate environment configuration
      validateEnvironment(env);
      
      const url = new URL(request.url);
      const origin = request.headers.get('Origin');
      
      // CORS headers with security hardening
      const corsHeaders = getCorsHeaders(origin, env);
      
      // Security headers for production
      const securityHeaders = getSecurityHeaders(env);
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new Response(null, { 
          headers: { ...corsHeaders, ...securityHeaders }
        });
      }
      
      // Route request to appropriate handler
      const response = await routeRequest(request, url, env, corsHeaders);
      
      // Add security headers to all responses
      const headers = new Headers(response.headers);
      Object.entries(securityHeaders).forEach(([key, value]) => {
        headers.set(key, value);
      });
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      
    } catch (error) {
      return handleError(error);
    }
  },
};