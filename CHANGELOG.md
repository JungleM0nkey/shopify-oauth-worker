# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive test infrastructure with Vitest
- Unit tests for validation, utils, and HMAC modules  
- Integration tests for worker functionality
- GitHub Actions CI/CD pipeline with automated testing
- ESLint and Prettier for code quality and formatting
- CodeQL security analysis workflow
- Comprehensive JSDoc documentation for all modules
- CONTRIBUTING.md with development guidelines
- Detailed README with architecture diagrams and examples
- Test coverage reporting
- Security scanning and dependency checks

### Changed
- Enhanced README with better architecture overview and troubleshooting
- Improved error handling and validation patterns
- Added proper JSDoc comments to all public functions
- Fixed `isValidEmbeddedContext` to return boolean values consistently

### Fixed
- Validation function boolean return type consistency
- Code style and formatting standardization

## [1.0.0] - Initial Release

### Added
- Core Cloudflare Worker functionality
- OAuth 2.0 flow implementation for Shopify apps
- HMAC verification for webhooks and OAuth callbacks
- API proxy for secure Shopify API access
- Browser extension authentication support
- KV storage for token and session management
- GDPR compliance webhook handlers
- Embedded app support with Shopify App Bridge
- Basic documentation and setup instructions

### Security
- HMAC signature verification for all Shopify requests
- Secure token storage with encryption
- Input validation and sanitization
- CSRF protection with state parameters
- Rate limiting and error handling