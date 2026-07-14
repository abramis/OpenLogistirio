#!/usr/bin/env sh
set -eu

base_url=${1:-http://localhost:${WEB_PORT:-8080}}

echo "Checking API readiness through ${base_url}/api/health/ready"
curl --fail --silent --show-error "${base_url}/api/health/ready" >/dev/null

echo "Checking production Compose syntax"
PRODUCTION_ENV_FILE=${PRODUCTION_ENV_FILE:-.env.production}
export PRODUCTION_ENV_FILE
docker compose --env-file "$PRODUCTION_ENV_FILE" -f docker-compose.production.yml config --quiet

echo "Production smoke check passed."
