#!/bin/bash
# Tensorax Studio — Deploy / Update script
# Run this on the droplet after the first-time setup is done.
# Usage: bash deploy.sh

set -e

APP_DIR="/var/www/tensorax"

echo "==> Pulling latest code..."
cd "$APP_DIR"
git pull

echo "==> Installing dependencies (including devDeps for build)..."
npm ci

echo "==> Building frontend..."
npm run build

echo "==> Pruning dev dependencies..."
npm prune --omit=dev

echo "==> Restarting app with PM2..."
pm2 reload ecosystem.config.cjs --env production

echo ""
echo "Deploy complete. App is live."
pm2 status
