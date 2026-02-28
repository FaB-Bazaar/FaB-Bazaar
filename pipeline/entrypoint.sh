#!/bin/bash
set -e

echo "[entrypoint] ============================================"
echo "[entrypoint] Container starting at $(date)"
echo "[entrypoint] Working directory: $(pwd)"
echo "[entrypoint] Python: $(python3 --version)"
echo "[entrypoint] Scripts present: $(ls /app/scripts/*.py 2>/dev/null | wc -l) .py files"
echo "[entrypoint] ============================================"

echo "[entrypoint] DB check - POSTGRES_URL_STAGING is set: $([ -n "$POSTGRES_URL_STAGING" ] && echo YES || echo NO)"
echo "[entrypoint] DB check - POSTGRES_URL_PROD is set:    $([ -n "$POSTGRES_URL_PROD" ] && echo YES || echo NO)"
echo "[entrypoint] Discord  - DISCORD_BOT_TOKEN is set:    $([ -n "$DISCORD_BOT_TOKEN" ] && echo YES || echo NO)"

# Dump all container env vars into /etc/environment so cron jobs can read them.
# (Cron doesn't inherit the Docker environment by default.)
printenv | grep -v "^_=" >> /etc/environment

# If arguments were passed (e.g. docker compose run ... bash -c "..."),
# exec them directly instead of starting cron.
if [ $# -gt 0 ]; then
    echo "[entrypoint] Running command: $*"
    exec "$@"
fi

echo "[entrypoint] No command passed — starting cron daemon..."
exec cron -f
