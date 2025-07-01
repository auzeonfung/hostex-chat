#!/usr/bin/env bash
# Setup Hostex Chat frontend and backend for production on Ubuntu behind Cloudflare
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root" >&2
  exit 1
fi

APP_DIR=/opt/hostex-chat
# Clone from the current directory by default so local changes are deployed.
REPO_URL="${REPO_URL:-$PWD}"
NODE_VERSION=22

# DOMAIN must be provided via environment variables
DOMAIN="${DOMAIN:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: DOMAIN=example.com sudo $0" >&2
  exit 1
fi

# derive base domain for certificate lookup (e.g. abc.ox.ci -> ox.ci)
BASE_DOMAIN="${DOMAIN#*.}"

# environment file used by all services
ENV_FILE="$APP_DIR/.env"

# install system packages
apt-get update
apt-get install -y curl gnupg2 ca-certificates lsb-release nginx git

# install Node.js LTS via nodesource
curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
apt-get install -y nodejs

# clone or update application code
mkdir -p "$APP_DIR"

# clone repository or update existing checkout
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin
  git checkout main
  git pull --ff-only origin main
fi

# write environment file used by all services
cat >"$ENV_FILE" <<EOF
HOSTEX_API_TOKEN=${HOSTEX_API_TOKEN:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
HOSTEX_API_BASE=${HOSTEX_API_BASE:-}
NEXT_PUBLIC_BACKEND_URL=https://$DOMAIN/api
PORT=4000
EOF
chown www-data:www-data "$ENV_FILE"
chmod 600 "$ENV_FILE"

# load env vars for the build
set -a
source "$ENV_FILE"
set +a

cd "$APP_DIR/frontend"
npm install
npm run build
# install backend dependencies
cd "$APP_DIR/backend"
npm install
# compile webhook worker
cd "$APP_DIR"
npx tsc scripts/webhook-worker.ts \
  --module commonjs --target es2020 --esModuleInterop --skipLibCheck \
  --outDir .
cd frontend

# create update script to pull latest code and rebuild
cat >/usr/local/bin/hostex-chat-update.sh <<'UPDATE'
#!/usr/bin/env bash
set -e
APP_DIR=/opt/hostex-chat
REPO_URL="${REPO_URL:-https://github.com/auzeonfung/hostex-chat.git}"
ENV_FILE="$APP_DIR/.env"

cd "$APP_DIR"
git remote set-url origin "$REPO_URL"
git fetch origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  git reset --hard origin/main
  set -a
  source "$ENV_FILE"
  set +a
  cd frontend
  npm install
  npm run build
  cd ../backend
  npm install
  cd ..
  npx tsc scripts/webhook-worker.ts \
    --module commonjs --target es2020 --esModuleInterop --skipLibCheck \
    --outDir .
  cd frontend
  systemctl restart hostex-chat.service
  systemctl restart hostex-chat-backend.service
  systemctl restart hostex-chat-worker.service
fi
UPDATE
chmod +x /usr/local/bin/hostex-chat-update.sh

# create systemd service
cat >/etc/systemd/system/hostex-chat.service <<SERVICE
[Unit]
Description=Hostex Chat
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/frontend
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now hostex-chat.service

# backend service
cat >/etc/systemd/system/hostex-chat-backend.service <<'BACKEND'
[Unit]
Description=Hostex Chat Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
BACKEND

systemctl daemon-reload
systemctl enable --now hostex-chat-backend.service

# webhook worker service
cat >/etc/systemd/system/hostex-chat-worker.service <<WORKER
[Unit]
Description=Hostex Chat Webhook Worker
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR/frontend
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $APP_DIR/scripts/webhook-worker.js
Restart=always
Environment=NODE_ENV=production
Environment=WEBHOOK_PORT=3100

[Install]
WantedBy=multi-user.target
WORKER

systemctl daemon-reload
systemctl enable --now hostex-chat-worker.service

# create systemd unit to update the app periodically
cat >/etc/systemd/system/hostex-chat-update.service <<UPDATE_SERVICE
[Unit]
Description=Update Hostex Chat from GitHub
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/hostex-chat-update.sh
UPDATE_SERVICE

cat >/etc/systemd/system/hostex-chat-update.timer <<UPDATE_TIMER
[Unit]
Description=Check Hostex Chat repository for updates

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=hostex-chat-update.service

[Install]
WantedBy=timers.target
UPDATE_TIMER

systemctl daemon-reload
systemctl enable --now hostex-chat-update.timer

# configure nginx
cat >/etc/nginx/sites-available/hostex-chat <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen [::]:443 ssl;
    server_name $DOMAIN;

    ssl_certificate /root/cert/$BASE_DOMAIN.pem;
    ssl_certificate_key /root/cert/$BASE_DOMAIN.key;

    # trust Cloudflare CDN
    real_ip_header CF-Connecting-IP;
    include /etc/nginx/cloudflare-real-ip.conf;

    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    location = /api/webhook/hostex {
        proxy_pass http://localhost:3100/hostex;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/hostex-chat /etc/nginx/sites-enabled/hostex-chat
rm -f /etc/nginx/sites-enabled/default
curl -fsSL https://www.cloudflare.com/ips-v4 | sed 's/^/set_real_ip_from /;s/$/;/' >/etc/nginx/cloudflare-real-ip.conf
curl -fsSL https://www.cloudflare.com/ips-v6 | sed 's/^/set_real_ip_from /;s/$/;/' >>/etc/nginx/cloudflare-real-ip.conf
systemctl reload nginx
