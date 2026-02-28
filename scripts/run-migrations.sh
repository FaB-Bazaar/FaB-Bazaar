#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/../lib/postgres/migrations"

# Load env from .env or .env.local (project root)
set -a
if [ -f "${SCRIPT_DIR}/../.env" ]; then
  source "${SCRIPT_DIR}/../.env"
elif [ -f "${SCRIPT_DIR}/../.env.local" ]; then
  source "${SCRIPT_DIR}/../.env.local"
fi
set +a

DB_USER="${POSTGRES_USER:-fabbazaar}"
DB_NAME="${POSTGRES_DB:-fabbazaar}"

run_psql() {
  docker exec fabbazaar-postgres psql -U "$DB_USER" "$DB_NAME" "$@"
}

# Create migration tracking table if it doesn't exist
run_psql -c "CREATE TABLE IF NOT EXISTS public._applied_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ DEFAULT now()
);"

echo "[migrate] Checking for pending migrations..."
pending=0

for f in $(ls "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | sort); do
  name=$(basename "$f" .sql)

  applied=$(run_psql -t -c "SELECT 1 FROM public._applied_migrations WHERE name = '${name}';" | tr -d ' \n')

  if [ "$applied" = "1" ]; then
    echo "[migrate] Already applied: $name"
  else
    echo "[migrate] Applying: $name"
    docker cp "$f" "fabbazaar-postgres:/tmp/migration_${name}.sql"
    run_psql -v ON_ERROR_STOP=1 -f "/tmp/migration_${name}.sql"
    run_psql -c "INSERT INTO public._applied_migrations (name) VALUES ('${name}') ON CONFLICT DO NOTHING;"
    docker exec fabbazaar-postgres rm -f "/tmp/migration_${name}.sql"
    echo "[migrate] Applied: $name"
    pending=$((pending + 1))
  fi
done

if [ "$pending" -eq 0 ]; then
  echo "[migrate] No pending migrations"
else
  echo "[migrate] Applied $pending migration(s)"
fi
