// Round-trip time to the backend health check (10 tries), to show whether the network limit is on.
const base = process.argv[2] ?? "http://backend:3000";
const label = process.argv[3] ?? "";
const t: number[] = [];
for (let i = 0; i < 10; i++) {
	const s = performance.now();
	try { await (await fetch(`${base}/api/health`)).arrayBuffer(); } catch {}
	t.push(performance.now() - s);
}
t.sort((a, b) => a - b);
console.log(`probe ${label}: health check median ${t[5].toFixed(1)} ms (min ${t[0].toFixed(1)}, max ${t[9].toFixed(1)})`);
