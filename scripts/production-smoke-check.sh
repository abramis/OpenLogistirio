#!/usr/bin/env sh
set -eu

base_url=${1:-http://localhost:${WEB_PORT:-8080}}

echo "Checking API readiness through ${base_url}/api/health/ready"
curl --fail --silent --show-error "${base_url}/api/health/ready" >/dev/null

echo "Checking production Compose syntax"
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-.env.production}
export PRODUCTION_ENV_FILE
docker compose --env-file "$PRODUCTION_ENV_FILE" -f docker-compose.production.yml config --quiet

echo "Checking latest database backup checksum"
docker compose --env-file "$PRODUCTION_ENV_FILE" -f docker-compose.production.yml exec -T backup \
  /bin/sh -ec 'latest=$(find /backups -maxdepth 1 -type f -name "open-logistirio-*.sql" | sort | tail -n 1); test -n "$latest"; cd /backups; sha256sum -c "$(basename "$latest").sha256"'

echo "Checking latest supporting-documents backup checksum"
docker compose --env-file "$PRODUCTION_ENV_FILE" -f docker-compose.production.yml exec -T files-backup \
  /bin/sh -ec 'latest=$(find /backups -maxdepth 1 -type f -name "open-logistirio-files-*.tar.gz" | sort | tail -n 1); test -n "$latest"; cd /backups; sha256sum -c "$(basename "$latest").sha256"'

echo "Production smoke check passed."
