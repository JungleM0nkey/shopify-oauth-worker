# Production Deployment Guide

## Overview

This guide covers deploying the Shopify OAuth Worker to production with all security, monitoring, and reliability features enabled.

## Pre-deployment Checklist

### 1. Environment Configuration

Ensure all required environment variables are set in `wrangler.toml`:

```toml
[vars]
SHOPIFY_APP_HANDLE = "your-app-handle"
APP_URL = "https://your-worker.workers.dev"
OAUTH_SCOPES = "read_products,read_orders"
SHOPIFY_API_VERSION = "2025-07"
ENVIRONMENT = "production"
```

### 2. Required Secrets

Set these secrets using `wrangler secret put`:

```bash
# Core OAuth functionality
wrangler secret put SHOPIFY_API_KEY
wrangler secret put SHOPIFY_API_SECRET

# Security - Generate a strong 32+ character key
wrangler secret put ENCRYPTION_KEY

# Optional monitoring (recommended)
wrangler secret put SENTRY_DSN
wrangler secret put SENTRY_PROJECT
wrangler secret put DATADOG_API_KEY
```

### 3. KV Namespaces

Create production KV namespaces:

```bash
wrangler kv:namespace create "SHOPS" --env production
wrangler kv:namespace create "AUTH_STATES" --env production  
wrangler kv:namespace create "API_KEYS" --env production
```

Update `wrangler.toml` with the production namespace IDs.

## Production Features

### Security

- **Data Encryption**: All sensitive data (access tokens, API keys) encrypted at rest
- **Rate Limiting**: Built-in protection against abuse with configurable limits
- **DDoS Protection**: Automatic detection and blocking of suspicious traffic
- **HMAC Verification**: All Shopify webhooks and OAuth callbacks verified

### Monitoring

- **Structured Logging**: JSON logs with request correlation IDs
- **Error Tracking**: Integration with Sentry for error monitoring
- **Performance Metrics**: Request duration and API call tracking
- **Health Checks**: Multiple endpoints for monitoring service health

### Reliability

- **Retry Logic**: Automatic retries for webhook registration
- **Graceful Degradation**: Fallback behaviors for various failure modes
- **Circuit Breaking**: Shopify API rate limit handling
- **Timeout Handling**: Configurable timeouts for external requests

## Health Check Endpoints

Use these endpoints for monitoring:

| Endpoint | Purpose | Response Time |
|----------|---------|---------------|
| `/health` | Basic health check | < 50ms |
| `/health/ready` | Kubernetes readiness probe | < 100ms |
| `/health/live` | Kubernetes liveness probe | < 50ms |
| `/health/deep` | Full dependency check | < 500ms |
| `/status` | Detailed service status | < 200ms |
| `/metrics` | Performance metrics | < 100ms |

## Rate Limits

Default rate limits per IP address:

- **API endpoints**: 100 requests/minute
- **Authentication**: 20 requests/hour  
- **Webhooks**: 1,000 requests/minute
- **Health checks**: 60 requests/minute

## Monitoring Setup

### Sentry Integration

1. Create a Sentry project
2. Set `SENTRY_DSN` and `SENTRY_PROJECT` secrets
3. Errors will automatically be tracked with context

### Datadog Integration

1. Get Datadog API key
2. Set `DATADOG_API_KEY` secret
3. Logs and metrics will be forwarded

### Example Alert Rules

#### High Error Rate
```
error_rate > 5% for 5 minutes
```

#### High Response Time
```
p95_response_time > 1000ms for 3 minutes
```

#### Rate Limit Exceeded
```
rate_limit_exceeded_count > 100 for 1 minute
```

## Security Considerations

### Encryption Key Management

- Use a strong, random 32+ character encryption key
- Rotate keys periodically (requires data migration)
- Store keys securely (never in code)

### Access Control

- Limit Shopify app permissions to minimum required scopes
- Monitor API key usage for suspicious patterns
- Implement key rotation policies

### Network Security

- Use HTTPS only
- Enable Cloudflare security features
- Monitor for unusual traffic patterns

## Deployment

### Initial Deployment

```bash
# Deploy to production
wrangler publish --env production

# Verify deployment
curl https://your-worker.workers.dev/health
```

### Zero-Downtime Updates

1. Deploy to staging environment first
2. Run health checks and integration tests
3. Deploy to production during low-traffic period
4. Monitor for issues post-deployment

### Rollback Procedure

```bash
# Check previous deployments
wrangler deployments list

# Rollback to previous version
wrangler rollback [deployment-id]
```

## Troubleshooting

### Common Issues

1. **Encryption errors**: Check `ENCRYPTION_KEY` is set correctly
2. **Rate limit issues**: Review rate limit policies
3. **KV errors**: Verify namespace IDs are correct
4. **Webhook failures**: Check webhook URLs and HMAC verification

### Debug Mode

Enable detailed logging by setting log level in your monitoring service:

```javascript
logger.debug('Detailed debug information', { context: data });
```

### Performance Issues

1. Check `/metrics` endpoint for performance data
2. Review Shopify API rate limit headers
3. Monitor KV operation latency
4. Check error rates by endpoint

## Maintenance

### Regular Tasks

- Monitor error rates and performance metrics
- Review and rotate encryption keys quarterly
- Update dependencies and security patches
- Clean up expired KV entries

### Scaling Considerations

- Monitor KV storage usage
- Review rate limit effectiveness
- Consider geographic distribution for global users
- Plan for Shopify API limit increases

## Support

For issues or questions:

1. Check health endpoints for service status
2. Review structured logs for error details
3. Use monitoring dashboards for performance insights
4. Escalate to development team with correlation IDs