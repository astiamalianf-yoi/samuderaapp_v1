#!/bin/bash
# Daily backup of the SAMUDRA field-study data (26 Nov 2026).
# - SQLite (fishermen, reports, usage log, histories): a consistent copy with VACUUM INTO, also while the app writes.
# - Redis (warnings stream, active warnings): an RDB snapshot.
# Keeps 14 days in /root/samudra-backups. Reads only; never stops or changes the app.
# Usage: samudra-backup.sh [stack]   (default samudra-com = production; samudra-staging for staging)
set -u
STACK="${1:-samudra-com}"
DIR="/root/samudra-backups/${STACK}"
STAMP="$(TZ=Asia/Jakarta date +%Y%m%d-%H%M)"
mkdir -p "$DIR"
LOG="$DIR/backup.log"
ok=1

if docker exec "${STACK}-backend" bun -e 'import {Database} from "bun:sqlite"; const d=new Database("/app/data/disaster.db"); d.run("VACUUM INTO \"/app/data/backup-tmp.db\"");' \
   && docker cp "${STACK}-backend:/app/data/backup-tmp.db" "$DIR/disaster-${STAMP}.db" >/dev/null; then
  docker exec "${STACK}-backend" rm -f /app/data/backup-tmp.db
else
  ok=0
fi

if docker exec "${STACK}-redis" redis-cli --rdb /data/backup-tmp.rdb >/dev/null 2>&1 \
   && docker cp "${STACK}-redis:/data/backup-tmp.rdb" "$DIR/redis-${STAMP}.rdb" >/dev/null; then
  docker exec "${STACK}-redis" rm -f /data/backup-tmp.rdb
else
  ok=0
fi

find "$DIR" -maxdepth 1 \( -name 'disaster-*.db' -o -name 'redis-*.rdb' \) -mtime +14 -delete
SIZE="$(du -sh "$DIR" 2>/dev/null | cut -f1)"
echo "$(TZ=Asia/Jakarta date '+%F %H:%M') backup $([ $ok = 1 ] && echo OK || echo FAILED) (folder ${SIZE})" >> "$LOG"
