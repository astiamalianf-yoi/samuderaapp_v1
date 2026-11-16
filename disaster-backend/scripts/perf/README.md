# Cycle-2 performance tests (staging only)

Run on the staging server in `/root/samudra-staging`. Never on production.

1. Report intake, 5,000 reports, normal network (helper container on the stack's network):
   `bash disaster-backend/scripts/perf/run-load.sh normal`
2. Same on a degraded network (1 Mbit/s, +150 ms, 2% loss, as in cycle 1):
   `bash disaster-backend/scripts/perf/run-load.sh degraded`
3. Web Push latency (a device must have SAMUDRA notifications on, on staging):
   `docker compose exec backend bun scripts/perf/push-latency.ts --count=30 --interval=3000`
4. WhatsApp latency (to one test group; the bot phone must be online):
   `docker compose exec backend bun scripts/perf/wa-latency.ts --count=30 --interval=4000 [--target=<group id>]`

Each prints one JSON block. The load test files reports at pantai_samas (no WhatsApp group);
reset staging afterwards if needed.
