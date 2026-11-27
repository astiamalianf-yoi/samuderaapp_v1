/**
 * Cycle-2 WhatsApp latency: queues N test messages to one chat and reads the bridge's timing of
 * each (queued by the backend -> accepted by WhatsApp through the OpenClaw gateway).
 * Run inside the backend container:
 *   bun scripts/perf/wa-latency.ts --target=1203...@g.us --count=30 --interval=4000
 * Without --target, the first group of pantai_lampuuk is used.
 */
import { initRedis, redis } from "../../src/lib/redis";
import { groupsForBeach, sendOpenClawReply } from "../../src/lib/openclaw";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const COUNT = Number(arg("count", "30"));
const INTERVAL = Number(arg("interval", "4000"));
const TARGET = arg("target", "") || groupsForBeach("pantai_lampuuk")[0] || "";
const WAIT = Number(arg("wait", "30000"));
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : NaN; };

async function main() {
	await initRedis();
	if (!TARGET) { console.log("No target: pass --target=<group id>"); process.exit(1); }
	const startId = `${Date.now()}-0`;
	for (let i = 1; i <= COUNT; i++) {
		await sendOpenClawReply(TARGET, `🧪 Uji kecepatan SAMUDRA ${i}/${COUNT} — pesan uji, abaikan.`);
		await Bun.sleep(INTERVAL);
	}
	await Bun.sleep(WAIT);
	const rows = (await redis.xRange("whatsapp:sendtimes", startId, "+")) as any[];
	const total: number[] = [], send: number[] = [];
	let ok = 0, n = 0;
	for (const r of rows) {
		const m = r.message;
		if (m.target !== TARGET) continue;
		n++;
		if (m.ok !== "1") continue;
		ok++;
		total.push(Number(m.sentAt) - Number(m.queuedAt));
		send.push(Number(m.sentAt) - Number(m.startedAt));
	}
	const sum = (xs: number[]) => ({ n: xs.length, median: +pct(xs, 50).toFixed(0), p95: +pct(xs, 95).toFixed(0), max: xs.length ? Math.max(...xs) : null });
	console.log(JSON.stringify({
		test: "whatsapp-latency", target: `…${TARGET.slice(-10)}`, queued: COUNT, recorded: n, accepted: ok,
		acceptedRatePct: COUNT ? +((100 * ok) / COUNT).toFixed(1) : 0,
		// queued -> accepted: includes the bridge polling the queue (every 2 s) and the gateway send
		queuedToAcceptedMs: sum(total), gatewaySendMs: sum(send),
	}, null, 1));
	process.exit(0);
}
main();
