#!/usr/bin/env bash
set -euo pipefail
MAX_DB_BACKUP_AGE_HOURS="${MAX_DB_BACKUP_AGE_HOURS:-24}"; MIN_FREE_DISK_PERCENT="${MIN_FREE_DISK_PERCENT:-15}"
latest=$(find /opt/rdevents/backups/releases -name db.sql.gz -type f | sort | tail -n1)
[ -n "$latest" ]
age=$(( ( $(date +%s) - $(stat -c %Y "$latest") ) / 3600 ))
[ "$age" -le "$MAX_DB_BACKUP_AGE_HOURS" ]
free=$(df /opt/rdevents | awk 'NR==2{print 100-$5}' | tr -d '%')
[ "$free" -ge "$MIN_FREE_DISK_PERCENT" ]
echo "Backup health ok"
