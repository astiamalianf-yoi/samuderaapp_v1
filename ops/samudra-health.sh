#!/bin/bash
# Daily health line of the SAMUDRA field study (26 Nov 2026). Reads only; prints no secrets, numbers or names.
# Writes one line to /root/samudra-backups/<stack>/health.log, e.g.
#   2026-12-05 06:00 backend=healthy ml=healthy redis=healthy web=running bridge=running gateway=healthy
#     forecast=06:28(ok 3/3) wa_in=05:51 wa_out=05:52 events_yday=37 disk=41%
# Usage: samudra-health.sh [stack]   (default samudra-com)
set -u
STACK="${1:-samudra-com}"
DIR="/root/samudra-backups/${STACK}"
mkdir -p "$DIR"
st() { docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${STACK}-$1" 2>/dev/null || echo missing; }
line="$(TZ=Asia/Jakarta date '+%F %H:%M') backend=$(st backend) ml=$(st ml) redis=$(st redis) web=$(st web) bridge=$(st openclaw-bridge) gateway=$(st openclaw-gateway)"

db="$(docker exec "${STACK}-backend" bun -e '
import {Database} from "bun:sqlite";
const d=new Database("/app/data/disaster.db",{readonly:true});
const wib=(s)=>s?new Date(Date.parse(s.replace(" ","T")+"Z")+7*3600e3).toISOString().slice(11,16):"none";
const last=d.query("select fetched_at f from bmkg_snapshots order by id desc limit 1").get();
const ok=d.query("select count(*) n from (select weather from bmkg_snapshots order by id desc limit 3) where json_extract(weather,\"$.available\")=1").get();
const y=new Date(Date.now()+7*3600e3-864e5).toISOString().slice(0,10);
const ev=d.query("select count(*) n from app_events where day=?").get(y);
console.log(`forecast=${wib(last?.f)}(ok ${ok.n}/3) events_yday=${ev.n}`);
' 2>/dev/null || echo 'db=unreadable')"

wa() { docker exec "${STACK}-redis" redis-cli --raw XREVRANGE "$1" + - COUNT 1 2>/dev/null | head -1 | cut -d- -f1; }
hm() { [ -n "$1" ] && TZ=Asia/Jakarta date -d "@$(( $1 / 1000 ))" '+%m-%d %H:%M' || echo none; }
win="$(hm "$(wa whatsapp:incoming)")"; wout="$(hm "$(wa whatsapp:outgoing)")"
disk="$(df -P / | awk 'NR==2{print $5}')"

echo "$line $db wa_in=$win wa_out=$wout disk=$disk" >> "$DIR/health.log"
tail -1 "$DIR/health.log"
