#!/usr/bin/env bash
set -euo pipefail
root_dir=/home/ecs-user/woshi
image_archive="${1:?image archive required}"
image_tag="${2:?image tag required}"
cd "$root_dir"
test -f .env
test -f compose.yaml
docker load -i "$image_archive"
export WOSHI_IMAGE_TAG="$image_tag"
sudo systemctl disable --now woshi-api woshi-web 2>/dev/null || true
docker compose -f compose.yaml run --rm --no-deps -w /app/packages/db api \
  /app/packages/db/node_modules/.bin/prisma migrate deploy
if [[ ! -f .admin-seeded ]]; then
  test -f admin-initial-password
  ADMIN_INITIAL_PASSWORD="$(cat admin-initial-password)" \
    docker compose -f compose.yaml run --rm --no-deps -e ADMIN_INITIAL_PASSWORD api \
    node /app/apps/api/dist/seed-admin.js
  touch .admin-seeded
fi
docker compose -f compose.yaml up -d --remove-orphans
for attempt in {1..30}; do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null \
    && curl -fsS http://127.0.0.1:3000/family/ >/dev/null; then
    rm -f "$image_archive"
    exit 0
  fi
  sleep 2
done
docker compose -f compose.yaml ps
docker compose -f compose.yaml logs --tail=50
exit 1
