#!/bin/bash
set -euo pipefail

# Load env from .env or .env.local (project root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
if [ -f "${SCRIPT_DIR}/../.env" ]; then
  source "${SCRIPT_DIR}/../.env"
elif [ -f "${SCRIPT_DIR}/../.env.local" ]; then
  source "${SCRIPT_DIR}/../.env.local"
fi
set +a

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="fabbazaar_backup_${TIMESTAMP}.sql.gz"
TMP_PATH="/tmp/${BACKUP_FILE}"

echo "[$(date)] Starting backup: ${BACKUP_FILE}"

# Dump from running container and compress
docker exec fabbazaar-postgres \
  pg_dump -U "${POSTGRES_USER:-fabbazaar}" "${POSTGRES_DB:-fabbazaar_dev}" \
  | gzip > "${TMP_PATH}"

# Upload to R2 (S3-compatible)
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
aws s3 cp "${TMP_PATH}" \
  "s3://${R2_BUCKET_NAME:-fabbazaar-backups}/${BACKUP_FILE}" \
  --endpoint-url "https://${CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com" \
  --region auto

rm -f "${TMP_PATH}"
echo "[$(date)] Backup complete: ${BACKUP_FILE}"
