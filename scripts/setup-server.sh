#!/usr/bin/env bash
set -euo pipefail
root_dir=/home/ecs-user/woshi
mkdir -p "$root_dir/releases"
if [[ ! -f "$root_dir/.env" ]]; then echo "Create $root_dir/.env first" >&2; exit 1; fi
sudo tee /etc/systemd/system/woshi-api.service >/dev/null <<'UNIT'
[Unit]
Description=Woshi API
After=network-online.target docker.service
Wants=network-online.target
[Service]
User=ecs-user
WorkingDirectory=/home/ecs-user/woshi/current
EnvironmentFile=/home/ecs-user/woshi/.env
Environment=PORT=3001
ExecStart=/home/ecs-user/woshi/current/apps/api/node_modules/.bin/tsx /home/ecs-user/woshi/current/apps/api/src/server.ts
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
sudo tee /etc/systemd/system/woshi-web.service >/dev/null <<'UNIT'
[Unit]
Description=Woshi Web
After=network-online.target
Wants=network-online.target
[Service]
User=ecs-user
WorkingDirectory=/home/ecs-user/woshi/current/apps/web
EnvironmentFile=/home/ecs-user/woshi/.env
ExecStart=/usr/local/bin/node /home/ecs-user/woshi/current/apps/web/node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
sudo tee /etc/nginx/snippets/woshi.conf >/dev/null <<'CONF'
location = /family { return 308 /family/; }
location ^~ /family/api/ {
    proxy_pass http://127.0.0.1:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
location ^~ /family/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
CONF
config=/etc/nginx/sites-available/share.libms.top
if ! sudo grep -q 'snippets/woshi.conf' "$config"; then
  sudo cp "$config" "${config}.woshi-backup-$(date +%Y%m%d%H%M%S)"
  sudo sed -i '0,/    index index.html;/s#    index index.html;#    index index.html;\n    include /etc/nginx/snippets/woshi.conf;#' "$config"
fi
sudo nginx -t
sudo systemctl daemon-reload
sudo systemctl enable woshi-api woshi-web
sudo systemctl reload nginx
