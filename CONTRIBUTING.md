# Contributing to Shopify OAuth Worker

Thank you for your interest in contributing to Shopify OAuth Worker! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contribution Guidelines](#contribution-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Code Style](#code-style)
- [Security](#security)

## Code of Conduct

This project adheres to a code of conduct that we expect all contributors to follow. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Cloudflare account (for testing)
- Basic understanding of:
  - JavaScript/ES modules
  - Cloudflare Workers
  - Shopify OAuth flow
  - Web APIs

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/shopify-oauth-worker.git
   cd shopify-oauth-worker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up test environment**
   ```bash
   # Copy example configuration
   cp wrangler.toml.example wrangler.toml
   
   # Create test KV namespaces (optional, for integration testing)
   wrangler kv:namespace create "SHOPS" --preview
   wrangler kv:namespace create "AUTH_STATES" --preview
   wrangler kv:namespace create "API_KEYS" --preview
   ```

4. **Run tests to verify setup**
   ```bash
   npm test
   ```

## Contribution Guidelines

### Types of Contributions

We welcome the following types of contributions:

- 🐛 **Bug fixes** - Fix existing issues
- ✨ **New features** - Add new functionality
- 📝 **Documentation** - Improve or add documentation
- 🧪 **Tests** - Add or improve test coverage
- 🔧 **Refactoring** - Improve code structure
- 🎨 **UI/UX** - Improve user interface
- 🔒 **Security** - Security improvements

### Before You Start

1. **Check existing issues** - Look for similar issues or feature requests
2. **Create an issue** - If none exists, create one to discuss your idea
3. **Get feedback** - Wait for maintainer feedback before starting work
4. **Small PRs** - Keep changes focused and manageable

### Branch Naming

Use descriptive branch names with prefixes:

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `test/description` - Test additions/improvements
- `refactor/description` - Code refactoring

Examples:
- `feature/add-token-refresh`
- `fix/hmac-verification-edge-case`
- `docs/improve-api-documentation`

## Pull Request Process

### 1. Create Your Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes
- Follow the [code style guidelines](#code-style)
- Add tests for new functionality
- Update documentation as needed
- Ensure all tests pass

### 3. Commit Changes
Use conventional commit messages:
```bash
git commit -m "feat: add token refresh mechanism"
git commit -m "fix: resolve HMAC verification issue"
git commit -m "docs: update API documentation"
git commit -m "test: add unit tests for validation module"
```

### 4. Push and Create PR
```bash
git push origin feature/your-feature-name
```

Create a pull request with:
- **Clear title** describing the change
- **Detailed description** explaining what and why
- **Link to related issues** using keywords like "Fixes #123"
- **Screenshots** for UI changes
- **Testing instructions** for reviewers

### 5. PR Review Process

1. **Automated checks** must pass (CI/CD, tests, linting)
2. **Code review** by at least one maintainer
3. **Address feedback** promptly and professionally
4. **Final approval** from maintainer
5. **Merge** (maintainers will handle this)

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npx vitest tests/unit/validation.test.js

# Run in watch mode
npm run test:watch
```

### Test Requirements

- **New features** must include unit tests
- **Bug fixes** should include regression tests
- **All tests** must pass before merging
- **Coverage** should not decrease significantly

### Writing Tests

Follow the existing test patterns:

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '../lib/module.js';
import { createMockEnv } from './utils/mocks.js';

describe('module functionality', () => {
  let mockEnv;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  it('should handle valid input correctly', () => {
    const result = functionToTest('valid-input');
    expect(result).toBe(expectedValue);
  });

  it('should handle invalid input gracefully', () => {
    expect(() => functionToTest(null)).toThrow('Expected error message');
  });
});
```

## Code Style

### Linting and Formatting

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Check formatting
npm run format:check

# Fix formatting
npm run format
```

### JavaScript Style Guide

- **ES Modules** - Use `import`/`export` syntax
- **Modern JavaScript** - Use ES2022+ features
- **Async/Await** - Prefer over Promises chains
- **Error Handling** - Always handle errors appropriately
- **Comments** - Use JSDoc for functions, inline for complex logic

### Function Documentation

Document all public functions with JSDoc:

```javascript
/**
 * Validates a Shopify shop domain format
 * @param {string} shop - The shop domain to validate
 * @returns {boolean} True if valid, false otherwise
 * @example
 * isValidShopDomain('example.myshopify.com') // returns true
 * isValidShopDomain('invalid.com') // returns false
 */
export function isValidShopDomain(shop) {
  if (!shop) return false;
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop);
}
```

### File Organization

- **Small, focused modules** - Each file should have a single responsibility
- **Clear naming** - Use descriptive names for files and functions
- **Consistent structure** - Follow existing patterns
- **Avoid deep nesting** - Keep functions readable

## Security

### Security Guidelines

- **Validate all inputs** - Never trust user input
- **Use HMAC verification** - For all Shopify webhooks and callbacks
- **Secure token storage** - Encrypt sensitive data
- **Rate limiting** - Implement appropriate limits
- **Error messages** - Don't leak sensitive information

### Reporting Security Issues

**DO NOT** create public issues for security vulnerabilities.

Instead:
1. Email security issues to [maintainer email]
2. Include detailed description and reproduction steps
3. Allow time for fix before public disclosure

## Questions?

- 💬 [GitHub Discussions](https://github.com/JungleM0nkey/shopify-oauth-worker/discussions) - General questions
- 🐛 [GitHub Issues](https://github.com/JungleM0nkey/shopify-oauth-worker/issues) - Bug reports and feature requests
- 📖 [Wiki](./wiki/) - Detailed documentation

Thank you for contributing! 🎉