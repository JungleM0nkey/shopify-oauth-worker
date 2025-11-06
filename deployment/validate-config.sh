#!/bin/bash

# Deployment Configuration Validation Script
# This script validates that all required configuration is in place before deployment

set -e

echo "🔍 Validating deployment configuration..."
echo ""

ERRORS=0
WARNINGS=0

# Check if wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
  echo "❌ ERROR: wrangler.toml not found"
  exit 1
fi

echo "✅ wrangler.toml found"

# Check KV namespace IDs
echo ""
echo "Checking KV namespace configuration..."

if grep -q 'binding = "SHOPS"' wrangler.toml && grep -A1 'binding = "SHOPS"' wrangler.toml | grep -q 'id = ""'; then
  echo "❌ ERROR: SHOPS KV namespace ID is empty"
  ((ERRORS++))
else
  echo "✅ SHOPS KV namespace ID configured"
fi

if grep -q 'binding = "AUTH_STATES"' wrangler.toml && grep -A1 'binding = "AUTH_STATES"' wrangler.toml | grep -q 'id = ""'; then
  echo "❌ ERROR: AUTH_STATES KV namespace ID is empty"
  ((ERRORS++))
else
  echo "✅ AUTH_STATES KV namespace ID configured"
fi

if grep -q 'binding = "API_KEYS"' wrangler.toml && grep -A1 'binding = "API_KEYS"' wrangler.toml | grep -q 'id = ""'; then
  echo "❌ ERROR: API_KEYS KV namespace ID is empty"
  ((ERRORS++))
else
  echo "✅ API_KEYS KV namespace ID configured"
fi

# Check environment variables
echo ""
echo "Checking environment variables..."

if grep -q 'SHOPIFY_APP_HANDLE = ""' wrangler.toml; then
  echo "⚠️  WARNING: SHOPIFY_APP_HANDLE is empty"
  ((WARNINGS++))
else
  echo "✅ SHOPIFY_APP_HANDLE configured"
fi

if grep -q 'SHOPIFY_API_VERSION = ""' wrangler.toml; then
  echo "⚠️  WARNING: SHOPIFY_API_VERSION is empty (will use default)"
  ((WARNINGS++))
else
  echo "✅ SHOPIFY_API_VERSION configured"
fi

if grep -q 'OAUTH_SCOPES = ""' wrangler.toml; then
  echo "⚠️  WARNING: OAUTH_SCOPES is empty"
  ((WARNINGS++))
else
  echo "✅ OAUTH_SCOPES configured"
fi

if grep -q 'APP_URL = ""' wrangler.toml; then
  echo "❌ ERROR: APP_URL is empty (required for webhooks)"
  ((ERRORS++))
else
  echo "✅ APP_URL configured"
fi

# Check CORS configuration
if grep -q 'ALLOWED_ORIGINS = "\*"' wrangler.toml; then
  echo "⚠️  WARNING: ALLOWED_ORIGINS is set to '*' (wildcard). This should only be used in development."
  echo "   For production, specify exact origins: ALLOWED_ORIGINS = \"https://example.com,https://app.example.com\""
  ((WARNINGS++))
else
  echo "✅ ALLOWED_ORIGINS configured"
fi

# Check secrets (these can't be checked in wrangler.toml as they're set separately)
echo ""
echo "⚠️  NOTE: Remember to set secrets using 'wrangler secret put':"
echo "   - SHOPIFY_API_KEY"
echo "   - SHOPIFY_API_SECRET"
echo ""

# Summary
echo "════════════════════════════════════════"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "✅ All checks passed!"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "⚠️  Configuration valid with $WARNINGS warning(s)"
  echo "You can proceed with deployment, but review warnings above."
  exit 0
else
  echo "❌ Configuration invalid: $ERRORS error(s), $WARNINGS warning(s)"
  echo "Fix the errors above before deploying."
  exit 1
fi
