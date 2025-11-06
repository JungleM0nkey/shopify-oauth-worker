// Storefront OAuth Gateway - Main Worker File
// Modular architecture for better maintainability

import { validateEnvironment } from './src/validation/index.js';
import { getCorsHeaders } from './src/utils/index.js';
import { routeRequest } from './src/handlers/router.js';
import { handleError } from './src/errors/error-handler.js';
import { generateRequestId, createRequestLogger } from './src/utils/logger.js';
import { validateCorsConfig } from './src/utils/cors.js';

// Main Worker Export
export default {
  async fetch(request, env, _ctx) {
    // Generate request ID for tracking
    const requestId = generateRequestId();
    const logger = createRequestLogger(requestId, {
      method: request.method,
      url: request.url,
    });

    try {
      logger.info('Request received');

      // Validate environment configuration
      validateEnvironment(env);

      // Validate CORS configuration (warns if not properly set)
      validateCorsConfig(env);

      const url = new URL(request.url);

      // CORS headers for extension support (with origin validation)
      const corsHeaders = getCorsHeaders(request, env);

      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        logger.debug('Handling OPTIONS preflight request');
        return new Response(null, { headers: corsHeaders });
      }

      // Route request to appropriate handler
      const response = await routeRequest(request, url, env, corsHeaders, logger);

      logger.info('Request completed', { status: response.status });
      return response;
    } catch (error) {
      logger.error('Request failed', {
        error: error.message,
        stack: error.stack,
      });
      return handleError(error, logger);
    }
  },
};
