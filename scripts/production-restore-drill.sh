#!/usr/bin/env sh
set -eu

production_env_file=${PRODUCTION_ENV_FILE:-.env.production}
compose_file=${PRODUCTION_COMPOSE_FILE:-docker-compose.production.yml}

if [ ! -f "$production_env_file" ]; then
  echo "Production environment file not found: $production_env_file" >&2
  exit 1
fi

mkdir -p restore-drills

cleanup() {
  docker compose --env-file "$production_env_file" -f "$compose_file" \
    --profile restore-drill rm --stop --force restore-drill-db >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Starting isolated temporary MySQL for the restore drill"
docker compose --env-file "$production_env_file" -f "$compose_file" \
  --profile restore-drill up --detach --wait restore-drill-db

echo "Restoring and validating the latest database backup"
docker compose --env-file "$production_env_file" -f "$compose_file" \
  --profile restore-drill run --rm restore-drill

echo "Validating the latest supporting-documents archive"
docker compose --env-file "$production_env_file" -f "$compose_file" \
  --profile restore-drill run --rm files-restore-drill

echo "Restore drill passed. Reports were written to ./restore-drills/."
