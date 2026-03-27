#!/bin/bash
# ============================================================
# Tensorax Studio — One-Shot Server Setup
# ============================================================
# Run this ONCE on your DigitalOcean droplet to go from zero
# to a running production app.
#
# Usage:  bash setup-server.sh
# ============================================================

set -e

REPO="https://github.com/mo-ubr/TensoraxStudio.git"
APP_DIR="/var/www/tensorax"
NODE_VERSION="20"

echo ""
echo "=========================================="
echo "  Tensorax Studio — Server Setup"
echo "=========================================="
echo ""

# --- 1. Install Node.js if missing ---
if ! command -v node &> /dev/null; then
  echo "==> Installing Node.js $NODE_VERSION..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "==> Node.js already installed: $(node -v)"
fi

# --- 2. Install PM2 if missing ---
if ! command -v pm2 &> /dev/null; then
  echo "==> Installing PM2..."
  sudo npm install -g pm2
else
  echo "==> PM2 already installed: $(pm2 -v)"
fi

# --- 3. Install Nginx if missing ---
if ! command -v nginx &> /dev/null; then
  echo "==> Installing Nginx..."
  sudo apt-get update
  sudo apt-get install -y nginx
else
  echo "==> Nginx already installed"
fi

# --- 4. Clone the repo (fresh) ---
if [ -d "$APP_DIR" ]; then
  echo "==> Removing old $APP_DIR..."
  sudo rm -rf "$APP_DIR"
fi

echo "==> Cloning repo into $APP_DIR..."
sudo git clone "$REPO" "$APP_DIR"
sudo chown -R $USER:$USER "$APP_DIR"
cd "$APP_DIR"

# --- 5. Install dependencies & build ---
echo "==> Installing dependencies..."
npm ci

echo "==> Building frontend..."
npm run build

echo "==> Pruning dev dependencies..."
npm prune --omit=dev

# --- 6. Create assets directory if needed ---
mkdir -p "$APP_DIR/assets"

# --- 7. Set up Nginx reverse proxy ---
echo "==> Configuring Nginx..."
sudo tee /etc/nginx/sites-available/tensorax > /dev/null <<'NGINX'
server {
    listen 80;
    server_name _;

    client_max_body_size 100M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/tensorax /etc/nginx/sites-enabled/tensorax
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# --- 8. Start with PM2 ---
echo "==> Starting app with PM2..."
cd "$APP_DIR"
pm2 delete tensorax 2>/dev/null || true
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || true

echo ""
echo "=========================================="
echo "  DONE! Tensorax Studio is live."
echo "=========================================="
echo ""
echo "  Open http://$(curl -s ifconfig.me) in your browser"
echo ""
pm2 status
