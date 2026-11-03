#!/usr/bin/env bash
set -euo pipefail
release_dir="${1:?release directory required}"
root_dir=/home/ecs-user/woshi
if [[ ! -f "$root_dir/.env" ]]; then echo "Missing $root_dir/.env" >&2; exit 1; fi
set -a
. "$root_dir/.env"
set +a
cd "$release_dir"
export npm_config_registry=https://registry.npmmirror.com
pnpm install --filter api... --filter web... --frozen-lockfile --registry=https://registry.npmmirror.com
pnpm --filter @workspace/db generate
pnpm --filter @workspace/db migrate
if [[ ! -f "$root_dir/.admin-seeded" ]]; then
  export ADMIN_INITIAL_PASSWORD
  ADMIN_INITIAL_PASSWORD="$(cat "$root_dir/admin-initial-password")"
  pnpm --filter api exec tsx src/seed-admin.ts
  touch "$root_dir/.admin-seeded"
  unset ADMIN_INITIAL_PASSWORD
fi
pnpm --filter api build
pnpm --filter web build
ln -sfn "$release_dir" "$root_dir/current.new"
mv -Tf "$root_dir/current.new" "$root_dir/current"
sudo systemctl restart woshi-api woshi-web
sleep 3
curl -fsS http://127.0.0.1:3001/api/health >/dev/null
curl -fsS http://127.0.0.1:3000/family/ >/dev/null
