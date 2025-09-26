#!/bin/bash

# Deployment script for Shopify OAuth Worker

set -e

echo "🚀 Deploying Shopify OAuth Worker..."

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler is not installed. Please install it first:"
    echo "npm install -g wrangler"
    exit 1
fi

# Check if user is logged in
if ! wrangler whoami &> /dev/null; then
    echo "❌ Please login to Wrangler first:"
    echo "wrangler login"
    exit 1
fi

# Validate wrangler.toml exists
if [ ! -f "wrangler.toml" ]; then
    echo "❌ wrangler.toml not found. Please ensure you're in the project root."
    exit 1
fi

# Run tests before deployment
echo "🧪 Running tests..."
node tests/run-tests.js

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Deployment aborted."
    exit 1
fi

echo "✅ Tests passed!"

# Deploy to Cloudflare Workers
echo "📦 Deploying to Cloudflare Workers..."
wrangler publish

echo "✅ Deployment complete!"
echo "🔗 Your worker is now live!"

# Optional: Show deployment URL
echo "📋 Next steps:"
echo "1. Update your Shopify app settings with the worker URL"
echo "2. Set your secrets using: wrangler secret put SHOPIFY_API_KEY"
echo "3. Configure your KV namespaces if not already done"