/**
 * Cycle-2 load test: many reports at once against the report intake (no app internals imported,
 * so it also runs from a separate, network-limited container).
 *
 *   bun load-reports.ts --base=http://backend:3000 --count=5000 --concurrency=50 --beach=pantai_samas
 *
 * Prints JSON: latency percentiles, throughput, errors, and how many warning messages the run
 * produced (read from Redis, if REDIS_URL is reachable).
 */
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const BASE = arg("base", "http://backend:3000");
const COUNT = Number(arg("count", "5000"));
const CONC = Number(arg("concurrency", "50"));
const BEACH = arg("beach", "pantai_samas");
const CODE = arg("code", "Wn-5");
const LABEL = arg("label", "normal");
const REDIS_URL = process.env.REDIS_URL ?? "redis://redis:6379";

const pct = (xs: number[], p: number) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : NaN;
};

async function main() {
	const startedAt = Date.now();
	const lat: number[] = [];
	let errors = 0;
	const statuses: Record<string, number> = {};
	let next = 0;
	async function worker() {
		while (true) {
			const i = next++;
			if (i >= COUNT) return;
			const t0 = performance.now();
			try {
				const res = await fetch(`${BASE}/api/report/submit?beach_location=${BEACH}&lik_codes=${CODE}&channel=PWA&created_at_client=${Date.now()}`);
				await res.arrayBuffer();
				statuses[res.status] = (statuses[res.status] ?? 0) + 1;
				if (!res.ok) errors++;
			} catch {
				errors++;
				statuses.network = (statuses.network ?? 0) + 1;
			}
			lat.push(performance.now() - t0);
		}
	}
	await Promise.all(Array.from({ length: CONC }, worker));
	const endedAt = Date.now();

	let warningsNotified: number | null = null;
	let alertEvents: number | null = null;
	try {
		const { RedisClient } = await import("bun");
		const r = new RedisClient(REDIS_URL);
		const raw = (await r.send("XRANGE", ["alerts:stream", `${startedAt}-0`, "+"])) as any[];
		let n = 0, notified = 0;
		for (const [, fields] of raw ?? []) {
			const arr = Array.isArray(fields) ? fields : Object.entries(fields).flat();
			const json = arr[arr.indexOf("json") + 1];
			try {
				const ev = JSON.parse(json);
				if ((ev.input?.beach_location ?? ev.beachLocation) !== BEACH) continue;
				n++;
				if (ev.decision?.notify !== false) notified++;
			} catch {}
		}
		alertEvents = n; warningsNotified = notified;
		r.close();
	} catch (e) {
		console.error("redis check skipped:", (e as Error).message);
	}

	const secs = (endedAt - startedAt) / 1000;
	console.log(JSON.stringify({
		test: "report-intake-load", label: LABEL, beach: BEACH, count: COUNT, concurrency: CONC,
		durationSeconds: +secs.toFixed(2), throughputPerSecond: +(COUNT / secs).toFixed(1),
		latencyMs: { p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1), p99: +pct(lat, 99).toFixed(1), max: +Math.max(...lat).toFixed(1) },
		errors, statuses, alertEvents, warningsNotified,
	}, null, 1));
}
main();
