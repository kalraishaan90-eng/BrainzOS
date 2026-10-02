#!/usr/bin/env bash
# =============================================================================
# BrainzOS — Automated Nightly Database Backup (On-Premises)
# =============================================================================
# Retention: 14 Days
# Destination: Local Server Path or Mounted School Backup Drive
# Schedule via cron: 0 2 * * * /path/to/BrainzOS/scripts/backup-db.sh >> /var/log/brainzos-backup.log 2>&1
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/brainzos_backup_${TIMESTAMP}.dump"
LOG_PREFIX="[BrainzOS Backup $(date +'%Y-%m-%d %H:%M:%S')]"

mkdir -p "${BACKUP_DIR}"

echo "${LOG_PREFIX} Starting database snapshot from container 'brainzos-db'..."

# Execute pg_dump directly in custom binary format (-F c) for compressed, atomic backup
if ! docker exec brainzos-db pg_dump -U postgres -d postgres -F c > "${BACKUP_FILE}"; then
    echo "${LOG_PREFIX} ERROR: pg_dump execution failed!" >&2
    rm -f "${BACKUP_FILE}"
    exit 1
fi

# Verify backup size
FILE_SIZE=$(wc -c < "${BACKUP_FILE}" | tr -d ' ')
if [ "${FILE_SIZE}" -lt 1024 ]; then
    echo "${LOG_PREFIX} ERROR: Backup file suspiciously small (${FILE_SIZE} bytes). Possible dump failure!" >&2
    exit 1
fi

# Compute SHA-256 integrity checksum
sha256sum "${BACKUP_FILE}" > "${BACKUP_FILE}.sha256"

echo "${LOG_PREFIX} Backup created successfully: ${BACKUP_FILE} (${FILE_SIZE} bytes)"
echo "${LOG_PREFIX} Checksum generated: ${BACKUP_FILE}.sha256"

# Rotate backups: purge archives older than 14 days
echo "${LOG_PREFIX} Applying 14-day retention policy..."
find "${BACKUP_DIR}" -name "brainzos_backup_*.dump*" -mtime +14 -exec rm -v {} \;

echo "${LOG_PREFIX} Backup routine completed successfully."
