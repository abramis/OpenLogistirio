#!/usr/bin/env bash
set -euo pipefail

root_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$root_dir"

version=${PRODUCTION_CHECK_VERSION:-$(node -p "require('./package.json').version")}
git_sha=${PRODUCTION_CHECK_GIT_SHA:-local-production-check}
api_image=${PRODUCTION_CHECK_API_IMAGE:-open-logistirio-production-check-api}
web_image=${PRODUCTION_CHECK_WEB_IMAGE:-open-logistirio-production-check-web}
project=${PRODUCTION_CHECK_PROJECT:-open-logistirio-check-${RANDOM}-${RANDOM}}
web_port=${PRODUCTION_CHECK_WEB_PORT:-18088}
build_images=${PRODUCTION_CHECK_BUILD_IMAGES:-true}
base_url="http://127.0.0.1:${web_port}"
setup_token=$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))")
env_file=$(mktemp)
alternate_dir=$(mktemp -d)
compose_file="$root_dir/docker-compose.production.yml"

cleanup() {
  result=$?
  if [[ $result -ne 0 ]]; then
    docker compose --env-file "$env_file" -f "$compose_file" -p "$project" ps || true
    docker compose --env-file "$env_file" -f "$compose_file" -p "$project" logs --no-color || true
  fi
  docker compose --env-file "$env_file" -f "$compose_file" -p "$project" \
    --profile restore-drill down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -f "$env_file"
  rm -rf "$alternate_dir"
  trap - EXIT
  exit "$result"
}
trap cleanup EXIT

{
  echo "NODE_ENV=production"
  echo "APP_VERSION=$version"
  echo "GIT_SHA=$git_sha"
  echo "API_DOCS_ENABLED=false"
  echo "OPEN_LOGISTIRIO_API_IMAGE=$api_image"
  echo "OPEN_LOGISTIRIO_WEB_IMAGE=$web_image"
  echo "MYSQL_DATABASE=open_logistirio"
  echo "MYSQL_USER=openlog"
  echo "MYSQL_PASSWORD=ProductionCheckMysql2026Key"
  echo "MYSQL_ROOT_PASSWORD=ProductionCheckRoot2026Key"
  echo "REDIS_PASSWORD=ProductionCheckRedis2026Key"
  echo "JWT_ACCESS_SECRET=production-check-access-secret-2026-abcdef"
  echo "JWT_REFRESH_SECRET=production-check-refresh-secret-2026-abcdef"
  echo "INITIAL_SETUP_TOKEN=$setup_token"
  echo "FRONTEND_ORIGIN=$base_url"
  echo "WEB_BIND_ADDRESS=127.0.0.1"
  echo "WEB_PORT=$web_port"
  echo "BACKUP_DIR=/workspace/backups"
  echo "SUPPORTING_DOCUMENTS_DIR=/workspace/storage/supporting-documents"
  echo "BACKUP_INTERVAL_SECONDS=86400"
  echo "BACKUP_RETENTION_DAYS=30"
  echo "BACKUP_MAX_AGE_HOURS=36"
  echo "RESTORE_DRILL_MYSQL_ROOT_PASSWORD=ProductionCheckRestore2026Key"
  echo "RATE_LIMIT_WINDOW_MS=60000"
  echo "RATE_LIMIT_MAX=240"
  echo "TRUST_PROXY=true"
  echo "AADE_MYDATA_ENV=test"
  echo "AADE_MYDATA_PRODUCTION_READ_ENABLED=false"
  echo "AADE_MYDATA_PRODUCTION_ENABLED=false"
  echo "MYDATA_SCHEDULED_SYNC_ENABLED=false"
} > "$env_file"

export PRODUCTION_ENV_FILE="$env_file"
export COMPOSE_PROJECT_NAME="$project"
export INITIAL_SETUP_TOKEN="$setup_token"

if [[ $build_images == true ]]; then
  docker build \
    --file apps/api/Dockerfile.production \
    --build-arg "APP_VERSION=$version" \
    --build-arg "GIT_SHA=$git_sha" \
    --tag "$api_image:$version" \
    .
  docker build \
    --file apps/web/Dockerfile.production \
    --tag "$web_image:$version" \
    .
fi

docker compose --env-file "$env_file" -f "$compose_file" -p "$project" config --quiet
docker compose --env-file "$env_file" -f "$compose_file" -p "$project" \
  up --detach --no-build --pull never

BASE_URL="$base_url" node scripts/production-first-run-check.mjs

office_record=$(
  docker compose --env-file "$env_file" -f "$compose_file" -p "$project" exec -T mysql \
    /bin/sh -ec 'MYSQL_PWD="$MYSQL_PASSWORD" mysql --host=127.0.0.1 --user="$MYSQL_USER" --batch --raw --skip-column-names "$MYSQL_DATABASE" --execute="SELECT CONCAT_WS(CHAR(9), name, vatNumber, email, phone, address) FROM AccountingOffice LIMIT 1"'
)
expected_office_record=$'Fresh Install Accounting Office\t123456789\toffice@example.invalid\t2101234567\tAthens Test Address 1'
if [[ $office_record != "$expected_office_record" ]]; then
  echo "The first-run form did not persist every accounting-office field." >&2
  exit 1
fi

docker compose --env-file "$env_file" -f "$compose_file" -p "$project" \
  --profile maintenance run --rm --no-deps backup-before-update

./scripts/production-smoke-check.sh "$base_url"
./scripts/production-restore-drill.sh

docker compose --env-file "$env_file" -f "$compose_file" -p "$project" down
cp "$compose_file" "$alternate_dir/docker-compose.production.yml"
docker compose --env-file "$env_file" -f "$alternate_dir/docker-compose.production.yml" -p "$project" \
  up --detach --no-build --pull never
BASE_URL="$base_url" node scripts/production-existing-install-check.mjs

echo "Production Compose fresh install, backup/restore, restart, and cross-directory checks passed."
