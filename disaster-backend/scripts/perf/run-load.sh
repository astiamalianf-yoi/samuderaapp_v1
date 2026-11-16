#!/bin/bash
# Usage: bash disaster-backend/scripts/perf/run-load.sh normal|degraded [count] [concurrency]
# Runs load-reports.ts from a separate container on the stack's network, so the network can be
# limited for the client only (tc netem), not for the backend itself.
set -e
MODE=${1:-normal}; COUNT=${2:-5000}; CONC=${3:-50}
# A beach without a WhatsApp group and without an active warning: Samas for normal, Depok for degraded.
BEACH=${4:-$([ "$MODE" = degraded ] && echo pantai_depok || echo pantai_samas)}
nets() { docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$(docker compose ps -q "$1")" | tr ' ' '\n' | grep -v '^$' | sort; }
# The network that both the backend and Redis are on (not the public proxy network).
NET=$(comm -12 <(nets backend) <(nets redis) | head -1)
[ -n "$NET" ] || { echo "no shared network between backend and redis"; exit 1; }
echo "network: $NET, mode: $MODE, beach: $BEACH, reports: $COUNT, concurrency: $CONC"
SHAPE=""
if [ "$MODE" = "degraded" ]; then
  SHAPE="export DEBIAN_FRONTEND=noninteractive; apt-get update -qq >/dev/null && apt-get install -y -qq iproute2 >/dev/null 2>&1 && tc qdisc add dev eth0 root netem delay 150ms loss 2% rate 1mbit &&"
fi
docker run --rm --cap-add NET_ADMIN --network "$NET" -e REDIS_URL=redis://redis:6379 \
  -v "$PWD/disaster-backend/scripts/perf:/perf:ro" oven/bun:1 \
  sh -c "$SHAPE bun /perf/load-reports.ts --base=http://backend:3000 --count=$COUNT --concurrency=$CONC --beach=$BEACH --label=$MODE"
