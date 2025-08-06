import { ConfigurationError, ValidationError } from './errors.js';

// Error Handler
export function handleError(error) {
  console.error('Worker error:', error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  
  // Return HTML error for browser requests
  if (error instanceof ConfigurationError || error instanceof ValidationError) {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body>
        <h1>Error ${statusCode}</h1>
        <p>${message}</p>
      </body>
      </html>`,
      {
        status: statusCode,
        headers: { 'Content-Type': 'text/html' },
      }
    );
  }
  
  // Return JSON error for API requests
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}