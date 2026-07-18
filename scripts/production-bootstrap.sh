#!/usr/bin/env bash
set -euo pipefail

production_env_file="${PRODUCTION_ENV_FILE:-.env.production}"
compose_file="${COMPOSE_FILE:-docker-compose.production.yml}"

if [[ ! -f "$production_env_file" ]]; then
  echo "Production env file not found: $production_env_file" >&2
  exit 1
fi

read -r -p "Accounting office name: " BOOTSTRAP_OFFICE_NAME
read -r -p "Accounting office VAT number (optional): " BOOTSTRAP_OFFICE_VAT
read -r -p "Administrator full name: " BOOTSTRAP_ADMIN_FULL_NAME
read -r -p "Administrator email: " BOOTSTRAP_ADMIN_EMAIL
read -r -s -p "Administrator password (14+ chars, upper/lower/number/symbol): " BOOTSTRAP_ADMIN_PASSWORD
echo

export BOOTSTRAP_OFFICE_NAME
export BOOTSTRAP_OFFICE_VAT
export BOOTSTRAP_ADMIN_FULL_NAME
export BOOTSTRAP_ADMIN_EMAIL
export BOOTSTRAP_ADMIN_PASSWORD

docker compose \
  --env-file "$production_env_file" \
  -f "$compose_file" \
  --profile bootstrap \
  run --rm bootstrap

unset BOOTSTRAP_ADMIN_PASSWORD
