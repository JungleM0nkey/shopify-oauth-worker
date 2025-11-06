// Structured Logging Utility

const _LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Create a logger for a request with context
export function createRequestLogger(requestId, context = {}) {
  const baseContext = {
    requestId,
    timestamp: new Date().toISOString(),
    ...context,
  };

  return {
    debug: (message, data = {}) => log('DEBUG', message, { ...baseContext, ...data }),
    info: (message, data = {}) => log('INFO', message, { ...baseContext, ...data }),
    warn: (message, data = {}) => log('WARN', message, { ...baseContext, ...data }),
    error: (message, data = {}) => log('ERROR', message, { ...baseContext, ...data }),
  };
}

function log(level, message, data) {
  const logEntry = {
    level,
    message,
    ...data,
  };

  // In production, this would integrate with a logging service
  // For now, use console with structured JSON
  const logMethod =
    level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log;
  logMethod(JSON.stringify(logEntry));
}

// Generate a unique request ID
export function generateRequestId() {
  return crypto.randomUUID();
}
