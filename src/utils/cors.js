// CORS Configuration and Origin Validation

// Configure allowed origins - this should be set via environment variables in production
// For now, we provide sensible defaults and support wildcard for development
export function getCorsHeaders(request, env) {
  const origin = request.headers.get('Origin');

  // Get allowed origins from environment or use defaults
  const allowedOriginsString = env.ALLOWED_ORIGINS || '';
  const allowedOrigins = allowedOriginsString
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  // If no origins configured and not in development, deny all
  // If ALLOWED_ORIGINS includes '*', allow all (for development only)
  let allowOrigin = null;

  if (allowedOrigins.includes('*')) {
    // Wildcard - allow the requesting origin
    allowOrigin = origin || '*';
  } else if (origin && isOriginAllowed(origin, allowedOrigins)) {
    // Origin is in whitelist
    allowOrigin = origin;
  } else if (allowedOrigins.length === 0) {
    // No configuration - for backward compatibility, allow all but log warning
    console.warn('SECURITY WARNING: ALLOWED_ORIGINS not configured, allowing all origins');
    allowOrigin = origin || '*';
  }

  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  if (allowOrigin) {
    headers['Access-Control-Allow-Origin'] = allowOrigin;
    // If we're allowing a specific origin, include credentials
    if (allowOrigin !== '*') {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }
  }

  return headers;
}

// Check if an origin is allowed
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) {
    return false;
  }

  // Direct match
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Pattern matching for subdomains (e.g., *.example.com)
  for (const allowed of allowedOrigins) {
    if (allowed.startsWith('*.')) {
      const domain = allowed.substring(2);
      if (
        origin.endsWith(`.${domain}`) ||
        origin === `https://${domain}` ||
        origin === `http://${domain}`
      ) {
        return true;
      }
    }
  }

  return false;
}

// Validate CORS configuration
export function validateCorsConfig(env) {
  if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.trim() === '') {
    console.warn(
      'CORS Configuration: ALLOWED_ORIGINS not set. ' +
        'This will allow all origins. Set ALLOWED_ORIGINS in environment variables for production.',
    );
    return false;
  }

  const origins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());

  if (origins.includes('*')) {
    console.warn(
      'CORS Configuration: Wildcard (*) detected in ALLOWED_ORIGINS. ' +
        'This should only be used in development environments.',
    );
  }

  return true;
}
