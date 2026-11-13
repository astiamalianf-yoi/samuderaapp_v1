/**
 * Clears all UAT test data so the field study starts from zero.
 *
 * Run on the server, in /root/samudra-com, after the UAT is signed off:
 *   docker compose exec backend bun run scripts/reset-for-field-study.ts          (dry run: shows what would go)
 *   docker compose exec backend bun run scripts/reset-for-field-study.ts --yes    (does it)
 *
 * What it does:
 *  - refuses while the BMKG test switch is on (BMKG_SIM_ENABLED=true)
 *  - saves a backup copy of the database first (data/backup-before-field-study-<time>.db)
 *  - empties every table filled by use: fishermen, their reports, incidents, held WhatsApp
 *    reports, class history, alerts and BMKG checks. The beach list is kept.
 *  - empties this stack's own Redis (samudra-redis): counts, active warnings, BMKG simulations,
 *    push subscriptions, queued WhatsApp messages. The .id app has its own Redis and is not touched.
 * The trust index then starts again from the Paper 2 survey baseline (Table 2), because it has no
 * app records left.
 */
import { Database } from "bun:sqlite";
import { createClient } from "redis";
import fs from "fs";
import path from "path";

const YES = process.argv.includes("--yes");
const DATABASE_URL = process.env.DATABASE_URL ?? "sqlite://./data/disaster.db";
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const dbPath = DATABASE_URL.replace(/^sqlite:\/\//, "");

// Children first, so foreign keys never block a delete.
const TABLES = [
	"fisherman_class_history",
	"incidents",
	"wa_held",
	"fisherman_reports",
	"fishermen",
	"reassurance_results",
	"shap_predictions",
	"bmkg_snapshots",
	"reports",
];

function fail(msg: string): never {
	console.error(`\n✋ ${msg}\n`);
	process.exit(1);
}

if (process.env.BMKG_SIM_ENABLED === "true") {
	fail("The BMKG test switch is still on. Set BMKG_SIM_ENABLED=false in .env, run `docker compose up -d backend`, then run this again.");
}
if (process.env.TRUST_INDEX_MODE === "paper") {
	console.warn("⚠️  TRUST_INDEX_MODE=paper (Table 2 frozen). Leave it only if that is the field-study condition.");
}
if (!fs.existsSync(dbPath)) fail(`Database not found at ${dbPath}`);

const db = new Database(dbPath);
const existing = new Set((db.query("select name from sqlite_master where type='table'").all() as { name: string }[]).map((r) => r.name));
const counts = TABLES.filter((t) => existing.has(t)).map((t) => ({
	table: t,
	rows: (db.query(`select count(*) as n from ${t}`).get() as { n: number }).n,
}));

const redis = createClient({ url: REDIS_URL });
await redis.connect();
const redisKeys = await redis.dbSize();

console.log("\nTest data now in the database:");
for (const c of counts) console.log(`  ${c.table.padEnd(26)} ${c.rows}`);
console.log(`Redis keys (${REDIS_URL}): ${redisKeys}`);

if (!YES) {
	console.log("\nDry run, nothing deleted. Add --yes to clear it.\n");
	await redis.quit();
	process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const backup = path.join(path.dirname(dbPath), `backup-before-field-study-${stamp}.db`);
db.run(`VACUUM INTO '${backup.replace(/'/g, "''")}'`);
console.log(`\nBackup saved: ${backup}`);

db.transaction(() => {
	for (const c of counts) db.run(`delete from ${c.table}`);
})();
db.run("VACUUM");
await redis.flushDb();

const left = counts.map((c) => (db.query(`select count(*) as n from ${c.table}`).get() as { n: number }).n).reduce((a, b) => a + b, 0);
console.log(`Cleared. Rows left in those tables: ${left}; Redis keys left: ${await redis.dbSize()}`);
console.log("Now restart the backend so its 10-minute caches start empty: docker compose restart backend\n");
await redis.quit();
