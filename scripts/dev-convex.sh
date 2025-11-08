#!/bin/bash

# Load environment variables from .env.local and start Convex dev server
# This ensures Convex backend has access to Cloudflare credentials

set -a  # automatically export all variables
source .env.local
set +a

echo "Starting Convex dev server with environment variables..."
echo "CLOUDFLARE_ACCOUNT_ID: ${CLOUDFLARE_ACCOUNT_ID:0:8}..."

npx convex dev
