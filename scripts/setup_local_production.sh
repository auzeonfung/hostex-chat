#!/usr/bin/env bash
# Deploy Hostex Chat from a local checkout without pulling from remote.
# Builds both frontend and backend and configures services and nginx.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root" >&2
  exit 1
fi

APP_DIR=$(pwd)
NODE_VERSION=22
DOMAIN="${DOMAIN:-}"

# Prompt for configuration
read -p "Domain [${DOMAIN:-}]: " input
DOMAIN=${input:-${DOMAIN:-}}
if [ -z "$DOMAIN" ]; then
  echo "Domain is required" >&2
  exit 1
fi
read -p "Hostex API token [${HOSTEX_API_TOKEN:-}]: " input
HOSTEX_API_TOKEN=${input:-${HOSTEX_API_TOKEN:-}}
read -p "OpenAI API key [${OPENAI_API_KEY:-}]: " input
OPENAI_API_KEY=${input:-${OPENAI_API_KEY:-}}
read -p "Hostex API base [${HOSTEX_API_BASE:-https://api.hostex.io/v3}]: " input
HOSTEX_API_BASE=${input:-${HOSTEX_API_BASE:-https://api.hostex.io/v3}}

BASE_DOMAIN="${DOMAIN#*.}"

ENV_FILE="$APP_DIR/.env"

apt-get update
apt-get install -y curl gnupg2 ca-certificates lsb-release nginx git

curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
apt-get install -y nodejs

mkdir -p "$APP_DIR"

# remove old Hostex Chat services
systemctl stop hostex-chat.service hostex-chat-backend.service hostex-chat-sync.service hostex-chat-sync.timer 2>/dev/null || true
systemctl disable hostex-chat.service hostex-chat-backend.service hostex-chat-sync.service hostex-chat-sync.timer 2>/dev/null || true
rm -f /etc/systemd/system/hostex-chat*.service /etc/systemd/system/hostex-chat*.timer
systemctl daemon-reload

# write environment file for runtime configuration
cat >"$ENV_FILE" <<EOF
HOSTEX_API_TOKEN=$HOSTEX_API_TOKEN
OPENAI_API_KEY=$OPENAI_API_KEY
HOSTEX_API_BASE=$HOSTEX_API_BASE
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
cd ..


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

cat >/etc/systemd/system/hostex-chat-backend.service <<SERVICE
[Unit]
Description=Hostex Chat Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$APP_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node backend/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE


systemctl daemon-reload
systemctl enable --now hostex-chat.service
systemctl enable --now hostex-chat-backend.service

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
        proxy_pass http://localhost:3000/api/;
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

}
NGINX

ln -sf /etc/nginx/sites-available/hostex-chat /etc/nginx/sites-enabled/hostex-chat
rm -f /etc/nginx/sites-enabled/default
curl -fsSL https://www.cloudflare.com/ips-v4 | sed 's/^/set_real_ip_from /;s/$/;/' >/etc/nginx/cloudflare-real-ip.conf
curl -fsSL https://www.cloudflare.com/ips-v6 | sed 's/^/set_real_ip_from /;s/$/;/' >>/etc/nginx/cloudflare-real-ip.conf
systemctl reload nginx
