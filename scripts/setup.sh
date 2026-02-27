#!/bin/bash
# FaB Bazaar - First-time VPS setup script
# Run once after cloning the repo and before/after docker compose up -d
# Safe to re-run — all steps are idempotent
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup.sh"
LOG_FILE="/var/log/fabbazaar-backup.log"
CRON_ENTRY="0 3 * * * ${BACKUP_SCRIPT} >> ${LOG_FILE} 2>&1"

echo "======================================"
echo " FaB Bazaar - Server Setup"
echo "======================================"

# ── 1. Ensure backup script is executable ──────────────────────────────────
echo "[1/4] Setting backup script permissions..."
chmod +x "$BACKUP_SCRIPT"
echo "      ✓ $BACKUP_SCRIPT is executable"

# ── 2. Create log file if it doesn't exist ─────────────────────────────────
echo "[2/4] Ensuring log file exists..."
if [ ! -f "$LOG_FILE" ]; then
  sudo touch "$LOG_FILE"
  sudo chown "$(whoami)" "$LOG_FILE"
  echo "      ✓ Created $LOG_FILE"
else
  echo "      ✓ $LOG_FILE already exists"
fi

# ── 3. Register crontab entry (idempotent) ─────────────────────────────────
echo "[3/4] Registering daily backup cron job (3am)..."
if crontab -l 2>/dev/null | grep -qF "$BACKUP_SCRIPT"; then
  echo "      ✓ Cron job already registered — skipping"
else
  (crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
  echo "      ✓ Cron job added: $CRON_ENTRY"
fi

# ── 4. Run a backup now to verify everything works ─────────────────────────
echo "[4/4] Running first backup to verify R2 credentials and DB access..."
if bash "$BACKUP_SCRIPT"; then
  echo "      ✓ Backup succeeded — R2 upload confirmed"
else
  echo "      ✗ Backup failed — check R2 credentials in .env.local"
  echo "        Required: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,"
  echo "                  CLOUDFLARE_ACCOUNT_ID, R2_BUCKET_NAME"
  exit 1
fi

echo ""
echo "======================================"
echo " Setup complete!"
echo " Backups run daily at 3am → $LOG_FILE"
echo " To verify cron: crontab -l"
echo "======================================"
