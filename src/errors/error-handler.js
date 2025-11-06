import { ConfigurationError, ValidationError } from './index.js';

// Error Handler
export function handleError(error, logger) {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  // Log with structured logger if available
  if (logger) {
    logger.error('Worker error', {
      statusCode,
      message,
      type: error.constructor.name,
      stack: error.stack,
    });
  } else {
    console.error('Worker error:', {
      statusCode,
      message,
      error: error.stack,
    });
  }

  // Return HTML error for browser requests (Configuration and Validation errors)
  if (error instanceof ConfigurationError || error instanceof ValidationError) {
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          h1 { color: #d32f2f; }
        </style>
      </head>
      <body>
        <h1>Error ${statusCode}</h1>
        <p>${message}</p>
      </body>
      </html>`,
      {
        status: statusCode,
        headers: { 'Content-Type': 'text/html' },
      },
    );
  }

  // Return JSON error for API requests
  return new Response(JSON.stringify({ error: message }), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}
