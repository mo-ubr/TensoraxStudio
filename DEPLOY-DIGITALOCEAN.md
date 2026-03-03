# Deploying Tensorax Studio to a DigitalOcean Droplet

## Architecture on the droplet

```
Browser → Apache (port 80/443) → Express on port 3000
                                      ├── /api/*   →  Express handlers (Vertex AI, Kling, etc.)
                                      └── /*        →  Serves React dist/ (built frontend)
```

One process, one port. Apache handles SSL and acts as the front door.

---

## 1. Create the Droplet

- **Image:** Ubuntu 24.04 LTS
- **Size:** Basic, $12/mo (2 GB RAM, 1 vCPU) minimum — $24/mo (2 vCPU) recommended
- **Region:** Pick closest to your users
- **Authentication:** SSH key (recommended)

---

## 2. First-time server setup (run once as root)

SSH into the droplet:
```bash
ssh root@YOUR_DROPLET_IP
```

Install Node.js 22 (LTS), Apache, PM2, and Git:
```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs git apache2

# PM2 (process manager)
npm install -g pm2

# Enable required Apache modules
a2enmod proxy proxy_http headers rewrite

# Confirm versions
node -v && npm -v && apache2 -v && pm2 -v
```

Create a non-root user (optional but recommended):
```bash
adduser tensorax
usermod -aG sudo tensorax
rsync --archive --chown=tensorax:tensorax ~/.ssh /home/tensorax
su - tensorax
```

---

## 3. Upload the project via FTP (FileZilla)

DigitalOcean droplets don't run plain FTP — they use **SFTP** (FTP over SSH), which is
already available the moment your droplet is created. No extra software needed on the server.
Use **FileZilla** (free) on Windows to connect.

### Connect FileZilla to your droplet

1. Open FileZilla → **File → Site Manager → New Site**
2. Fill in:
   | Field | Value |
   |---|---|
   | Protocol | **SFTP – SSH File Transfer Protocol** |
   | Host | `YOUR_DROPLET_IP` |
   | Port | `22` |
   | Logon Type | **Normal** |
   | User | `root` |
   | Password | your root password (or leave blank if using SSH key) |
3. If using an SSH key: **Edit → Settings → Connection → SFTP → Add key file** → browse to your `.ppk` or private key file
4. Click **Connect**

### Create the target folder on the droplet

Before uploading, create the folder via SSH:
```bash
mkdir -p /var/www/tensorax
```

### What to upload (and what to skip)

In FileZilla, navigate to `/var/www/tensorax/` on the right (remote) panel.
On the left (local) panel, browse to `C:\Users\marie\Documents\11 Apps\TensoraxStudio\`.

Upload everything **except** these folders/files (right-click → skip, or exclude before dragging):
- `node_modules/` — too large, will be installed on the server
- `dist/` — will be built on the server
- `.env.local` — contains local secrets, you'll create `.env` on the server instead

**Do upload:**
- All source files (`server/`, `components/`, `public/`, `assets/`, etc.)
- `package.json`, `package-lock.json`
- `vite.config.ts`, `tsconfig.json`, `tailwind.config.js`, `postcss.config.cjs`
- `ecosystem.config.cjs`, `apache.tensorax.conf`, `deploy.sh`
- `Tensorax-Key.json` ← upload this too (it's excluded from git but fine to upload via SFTP directly to the server)

### Lock down the key file after upload

Back in SSH on the droplet:
```bash
chmod 600 /var/www/tensorax/Tensorax-Key.json
```

---

## 5. Set environment variables

On the droplet, create the production `.env` file:
```bash
nano /var/www/tensorax/.env
```

Paste and fill in your values:
```
NODE_ENV=production

GOOGLE_PROJECT_ID=tensoraxstudio
GOOGLE_APPLICATION_CREDENTIALS=./Tensorax-Key.json
GOOGLE_LOCATION=us-central1

GEMINI_API_KEY=your_gemini_api_key

# Optional — only needed for DALL-E 3 fallback
OPENAI_API_KEY=sk-your-openai-api-key
```

Save with `Ctrl+O`, exit with `Ctrl+X`.

---

## 6. Add swap space (important for small droplets)

Heavy packages like `@google-cloud/aiplatform` require more RAM than a 1–2 GB droplet has.
Without swap, `npm ci` will silently hang or get killed mid-install.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile

# Persist across reboots
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Confirm swap is active
free -h
```

---

## 7. Install, build, and start the app

```bash
cd /var/www/tensorax

# Install all dependencies (devDeps needed for vite build)
npm ci

# Build the React frontend
npm run build

# Remove dev dependencies after build to save disk space
npm prune --omit=dev

# Start with PM2
pm2 start ecosystem.config.cjs --env production

# Save PM2 process list so it survives reboots
pm2 save
pm2 startup   # follow the command it prints
```

Check it's running:
```bash
pm2 status
pm2 logs tensorax --lines 30
```

Test the backend directly:
```bash
curl http://localhost:3000/api/health
```

---

## 8. Configure Apache

Copy the config and enable the site:
```bash
cp /var/www/tensorax/apache.tensorax.conf /etc/apache2/sites-available/tensorax.conf

# Edit and replace YOUR_DOMAIN_OR_IP with your actual domain or IP
nano /etc/apache2/sites-available/tensorax.conf

# Enable the site and disable the default
a2ensite tensorax.conf
a2dissite 000-default.conf

# Test config
apache2ctl configtest

# Reload Apache
systemctl reload apache2
```

Your app is now live at `http://YOUR_DOMAIN_OR_IP` 🎉

---

## 9. Add SSL (HTTPS) — free with Let's Encrypt

Only do this if you have a real domain pointed to your droplet's IP.

```bash
apt-get install -y certbot python3-certbot-apache
certbot --apache -d yourdomain.com
```

Certbot auto-renews. Your site will be at `https://yourdomain.com`.

---

## 10. Future deploys (after code changes)

1. Upload changed files via FileZilla (same SFTP connection as step 3)
2. SSH into the droplet and run:
```bash
ssh root@YOUR_DROPLET_IP
bash /var/www/tensorax/deploy.sh
```

`deploy.sh` runs `npm ci`, `npm run build`, and reloads the app — no need to restart Apache.

---

## Useful commands on the droplet

| Command | What it does |
|---|---|
| `pm2 status` | Show running processes |
| `pm2 logs tensorax` | Live logs |
| `pm2 restart tensorax` | Restart app |
| `pm2 reload tensorax` | Zero-downtime reload |
| `apache2ctl configtest` | Test Apache config |
| `systemctl reload apache2` | Apply Apache changes |
| `df -h` | Check disk space |

---

## Firewall setup (if ufw is enabled)

```bash
ufw allow OpenSSH
ufw allow 'Apache Full'
ufw enable
ufw status
```
