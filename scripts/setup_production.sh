#!/usr/bin/env bash
# Setup Hostex Chat for production on Ubuntu
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "This script must be run as root" >&2
  exit 1
fi

APP_DIR=/opt/hostex-chat
REPO_URL="https://github.com/example/hostex-chat.git"
NODE_VERSION=18

# DOMAIN must be provided via environment variables
DOMAIN="${DOMAIN:-}"

if [ -z "$DOMAIN" ]; then
  echo "Usage: DOMAIN=example.com sudo $0" >&2
  exit 1
fi

# derive base domain for certificate lookup (e.g. abc.ox.ci -> ox.ci)
BASE_DOMAIN="${DOMAIN#*.}"

# install system packages
apt-get update
apt-get install -y curl gnupg2 ca-certificates lsb-release nginx git

# install Node.js LTS via nodesource
curl -fsSL https://deb.nodesource.com/setup_$NODE_VERSION.x | bash -
apt-get install -y nodejs

# clone or update application code
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
else
  cd "$APP_DIR"
  git fetch origin
  git checkout main
  git pull --ff-only origin main
fi
cd "$APP_DIR/frontend"
npm install
npm run build

# create update script to pull latest code and rebuild
cat >/usr/local/bin/hostex-chat-update.sh <<'UPDATE'
#!/usr/bin/env bash
set -e
APP_DIR=/opt/hostex-chat
cd "$APP_DIR"
git fetch origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse origin/main)
if [ "$LOCAL" != "$REMOTE" ]; then
  git reset --hard origin/main
  cd frontend
  npm install
  npm run build
  systemctl restart hostex-chat.service
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
ExecStart=/usr/bin/npm start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable --now hostex-chat.service

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
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate /root/cert/$BASE_DOMAIN.pem;
    ssl_certificate_key /root/cert/$BASE_DOMAIN.key;

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
systemctl reload nginx
