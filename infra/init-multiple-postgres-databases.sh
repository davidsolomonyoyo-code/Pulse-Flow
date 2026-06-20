#!/bin/bash
# Creates one database per service. Each service owns its own schema —
# this script exists so `docker compose up` gives both identity-service and
# queue-service a separate database without any manual setup step, in
# keeping with "no shared database writes" from docs/MASTER_SPEC.md.
set -e

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
  echo "Creating databases: $POSTGRES_MULTIPLE_DATABASES"
  IFS=',' read -ra DB_LIST <<< "$POSTGRES_MULTIPLE_DATABASES"
  for db in "${DB_LIST[@]}"; do
    db_trimmed=$(echo "$db" | xargs)
    echo "  -> $db_trimmed"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
      SELECT 'CREATE DATABASE "$db_trimmed"'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db_trimmed')\gexec
EOSQL
  done
fi
