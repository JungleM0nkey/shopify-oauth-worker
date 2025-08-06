// Custom Error Classes
export class AuthenticationError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

export class ValidationError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = statusCode;
  }
}

export class ConfigurationError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ConfigurationError';
    this.statusCode = statusCode;
  }
}