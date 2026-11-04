#!/usr/bin/env bash
set -euo pipefail
root_dir=/home/ecs-user/woshi
: "${BETTER_AUTH_URL:?BETTER_AUTH_URL is required}"
: "${WECHAT_MINI_APPID:?WECHAT_MINI_APPID is required}"
: "${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
: "${PUBLIC_ORIGIN:?PUBLIC_ORIGIN is required}"
: "${PUBLIC_API_BASE:?PUBLIC_API_BASE is required}"
: "${SMS_AI_BASE_URL:?SMS_AI_BASE_URL is required}"
mkdir -p "$root_dir/releases"
chmod 700 "$root_dir"
if [[ ! -f "$root_dir/.env" ]]; then
  db_password="$(openssl rand -hex 24)"
  auth_secret="$(openssl rand -hex 48)"
  ingest_token="$(openssl rand -hex 48)"
  umask 077
  cat > "$root_dir/.env" <<ENV
DATABASE_URL=postgresql://woshi:${db_password}@127.0.0.1:5432/woshi
BETTER_AUTH_URL=${BETTER_AUTH_URL}
BETTER_AUTH_SECRET=${auth_secret}
WECHAT_MINI_APPID=${WECHAT_MINI_APPID}
WECHAT_MINI_SECRET=
ADMIN_EMAIL=${ADMIN_EMAIL}
PUBLIC_ORIGIN=${PUBLIC_ORIGIN}
PUBLIC_API_BASE=${PUBLIC_API_BASE}
SMS_INGEST_TOKEN=${ingest_token}
SMS_AI_BASE_URL=${SMS_AI_BASE_URL}
SMS_AI_MODEL=deepseek-flash
SMS_AI_API_KEY=
ENV
  printf 'POSTGRES_USER=woshi\nPOSTGRES_PASSWORD=%s\nPOSTGRES_DB=woshi\n' "$db_password" > "$root_dir/postgres.env"
  openssl rand -base64 36 > "$root_dir/admin-initial-password"
fi
if ! command -v psql >/dev/null; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16
fi
sudo systemctl enable --now postgresql
set -a
. "$root_dir/postgres.env"
set +a
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='woshi'" | grep -qx 1; then
  printf "CREATE ROLE woshi LOGIN PASSWORD '%s';\n" "$POSTGRES_PASSWORD" | sudo -u postgres psql -q
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='woshi'" | grep -qx 1; then
  sudo -u postgres createdb -O woshi woshi
fi
sudo -u postgres psql -d woshi -q -c 'GRANT ALL ON SCHEMA public TO woshi;'
pg_isready -h 127.0.0.1 -p 5432 -U woshi -d woshi
