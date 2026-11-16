/**
 * Cycle-2 Web Push latency: sends N test pushes to every push subscription on this server and
 * reads the delivery receipts that the app's service worker posts to /api/ack.
 * Run inside the backend container:  bun scripts/perf/push-latency.ts --count=30 --interval=3000
 */
import { sendNotification, setVapidDetails, type PushSubscription } from "web-push";
import { ACKS_STREAM, VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "../../src/config";
import { listPushSubscriptions } from "../../src/lib/push";
import { redis } from "../../src/lib/redis";

const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=") ?? d;
const COUNT = Number(arg("count", "30"));
const INTERVAL = Number(arg("interval", "3000"));
const LABEL = arg("label", "normal");
const WAIT = Number(arg("wait", "20000"));
const pct = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] : NaN; };

async function main() {
	setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
	const subs = await listPushSubscriptions();
	if (!subs.length) { console.log("No push subscriptions on this server: turn on notifications in the app first."); process.exit(1); }
	const run = `perf-${Date.now()}`;
	const startId = `${Date.now()}-0`;
	let sent = 0, failed = 0;
	for (let i = 1; i <= COUNT; i++) {
		for (const { metadata, ...sub } of subs) {
			const payload = JSON.stringify({ type: "PERF_TEST", title: "Uji kecepatan SAMUDRA", body: `Pesan uji ${i}/${COUNT}, abaikan.`, alertId: `${run}-${i}`, sentAt: Date.now() });
			try { await sendNotification(sub as PushSubscription, payload, { TTL: 60, urgency: "high" }); sent++; } catch { failed++; }
		}
		await Bun.sleep(INTERVAL);
	}
	await Bun.sleep(WAIT);
	const raw = await redis.xRange(ACKS_STREAM, startId, "+");
	const client: number[] = [], server: number[] = [];
	for (const e of raw as any[]) {
		try {
			const a = JSON.parse(e.message.json);
			if (a.transport !== "PUSH" || !String(a.alertId).startsWith(run)) continue;
			client.push(a.receivedAtClient - a.serverTimestamp);
			server.push(a.receivedAtServer - a.serverTimestamp);
		} catch {}
	}
	const sum = (xs: number[]) => ({ n: xs.length, median: +pct(xs, 50).toFixed(0), p95: +pct(xs, 95).toFixed(0), max: xs.length ? Math.max(...xs) : null });
	console.log(JSON.stringify({
		test: "web-push-latency", label: LABEL, run, subscriptions: subs.length, pushesSent: sent, sendFailures: failed,
		receiptsReceived: client.length, deliveryRatePct: sent ? +((100 * client.length) / sent).toFixed(1) : 0,
		// device clock: send -> arrival on the phone (depends on the phone clock);
		// server clock: send -> receipt back at the server (no clock difference, includes the receipt upload)
		latencyDeviceClockMs: sum(client), latencyServerClockMs: sum(server),
	}, null, 1));
	process.exit(0);
}
main();
