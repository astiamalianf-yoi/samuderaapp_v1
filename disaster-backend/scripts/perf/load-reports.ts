/**
 * Cycle-2 load test: many reports at once against the report intake (no app internals imported,
 * so it also runs from a separate, network-limited container).
 *
 *   bun load-reports.ts --base=http://backend:3000 --count=5000 --concurrency=50 --beach=pantai_samas
 *
 * Prints JSON: latency percentiles, throughput, errors, and (from the responses) how many reports
 * raised or updated the warning and how many of them announced it (should be 1 for one sign).
 */
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const BASE = arg("base", "http://backend:3000");
const COUNT = Number(arg("count", "5000"));
const CONC = Number(arg("concurrency", "50"));
const BEACH = arg("beach", "pantai_samas");
const CODE = arg("code", "Wn-5");
const LABEL = arg("label", "normal");

const pct = (xs: number[], p: number) => {
	const s = [...xs].sort((a, b) => a - b);
	return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : NaN;
};

async function main() {
	const startedAt = Date.now();
	const lat: number[] = [];
	let errors = 0;
	const statuses: Record<string, number> = {};
	let triggered = 0, notified = 0;
	const levels: Record<string, number> = {};
	const notifyReasons: Record<string, number> = {};
	let activeBefore: unknown = null;
	try {
		const a = await (await fetch(`${BASE}/api/reports/active?beach_location=${BEACH}`)).json();
		activeBefore = a?.active_warning ? { codes: a.active_warning.codes, expiresAt: a.active_warning.expiresAt } : null;
	} catch {}
	let next = 0;
	async function worker() {
		while (true) {
			const i = next++;
			if (i >= COUNT) return;
			const t0 = performance.now();
			try {
				const res = await fetch(`${BASE}/api/report/submit?beach_location=${BEACH}&lik_codes=${CODE}&channel=PWA&created_at_client=${Date.now()}`);
				const body = (await res.json().catch(() => null)) as any;
				if (body?.status === "triggered") {
					triggered++;
					const d = body.alertEvent?.decision ?? {};
					levels[d.final_risk_level ?? "?"] = (levels[d.final_risk_level ?? "?"] ?? 0) + 1;
					notifyReasons[d.notify_reason ?? "?"] = (notifyReasons[d.notify_reason ?? "?"] ?? 0) + 1;
					if (d.notify) notified++;
				}
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

	const secs = (endedAt - startedAt) / 1000;
	console.log(JSON.stringify({
		test: "report-intake-load", label: LABEL, beach: BEACH, count: COUNT, concurrency: CONC,
		durationSeconds: +secs.toFixed(2), throughputPerSecond: +(COUNT / secs).toFixed(1),
		latencyMs: { p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1), p99: +pct(lat, 99).toFixed(1), max: +Math.max(...lat).toFixed(1) },
		errors, statuses, warningActiveBefore: activeBefore,
		// from the responses: reports that raised or updated the warning, and how many announced it
		triggered, warningMessages: notified, notifyReasons, finalLevels: levels,
	}, null, 1));
}
main();
