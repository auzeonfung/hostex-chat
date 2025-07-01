#!/usr/bin/env bash
# Deploy Hostex Chat from a local checkout without pulling from remote.
# Builds both frontend and backend and configures services and nginx.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root" >&2
  exit 1
fi

APP_DIR=/opt/hostex-chat
SRC_DIR=$(pwd)
NODE_VERSION=22
DOMAIN="${DOMAIN:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: DOMAIN=example.com sudo $0" >&2
  exit 1
fi

BASE_DOMAIN="${DOMAIN#*.}"

ENV_FILE="$APP_DIR/.env"

apt-get update
apt-get install -y curl gnupg2 ca-certificates lsb-release nginx git rsync

curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
apt-get install -y nodejs

mkdir -p "$APP_DIR"
rsync -a --delete --exclude node_modules --exclude .git "$SRC_DIR/" "$APP_DIR/"

# write environment file for runtime configuration
cat >"$ENV_FILE" <<EOF
HOSTEX_API_TOKEN=${HOSTEX_API_TOKEN:-}
OPENAI_API_KEY=${OPENAI_API_KEY:-}
HOSTEX_API_BASE=${HOSTEX_API_BASE:-}
NEXT_PUBLIC_BACKEND_URL=https://$DOMAIN/api
PORT=4000
EOF
chown www-data:www-data "$ENV_FILE"
chmod 600 "$ENV_FILE"

# export vars for build
set -a
source "$ENV_FILE"
set +a

cd "$APP_DIR/frontend"
npm install
npm run build

cd "$APP_DIR/backend"
npm install

cd "$APP_DIR"
npx tsc scripts/webhook-worker.ts \
  --module commonjs --target es2020 --esModuleInterop --skipLibCheck \
  --outDir .
cd frontend

cat >/usr/local/bin/hostex-chat-sync.sh <<'SYNC'
#!/usr/bin/env bash
set -e
SRC_DIR="$SRC_DIR"
APP_DIR=/opt/hostex-chat
ENV_FILE="$APP_DIR/.env"
rsync -a --delete --exclude node_modules --exclude .git "$SRC_DIR/" "$APP_DIR/"
set -a
source "$ENV_FILE"
set +a
cd "$APP_DIR/frontend"
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
SYNC
chmod +x /usr/local/bin/hostex-chat-sync.sh

cat >/etc/systemd/system/hostex-chat.service <<SERVICE
[Unit]
Description=Hostex Chat Frontend
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

cat >/etc/systemd/system/hostex-chat-backend.service <<'BACKEND'
[Unit]
Description=Hostex Chat Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/hostex-chat/backend
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
BACKEND

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

cat >/etc/systemd/system/hostex-chat-sync.service <<SYNC_SERVICE
[Unit]
Description=Sync Hostex Chat from local checkout
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/hostex-chat-sync.sh
SYNC_SERVICE

cat >/etc/systemd/system/hostex-chat-sync.timer <<SYNC_TIMER
[Unit]
Description=Periodically sync Hostex Chat from local checkout

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min
Unit=hostex-chat-sync.service

[Install]
WantedBy=timers.target
SYNC_TIMER

systemctl daemon-reload
systemctl enable --now hostex-chat.service
systemctl enable --now hostex-chat-backend.service
systemctl enable --now hostex-chat-worker.service
systemctl enable --now hostex-chat-sync.timer

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
