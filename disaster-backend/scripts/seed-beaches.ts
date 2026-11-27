import { initDb, getDb, schema } from "../src/db";
import { eq } from "drizzle-orm";

const BEACHES = [
	{ name: "Pantai Lampuuk", slug: "pantai_lampuuk", latitude: 5.4833, longitude: 95.2333 },
	{ name: "Pantai Lhoknga", slug: "pantai_lhoknga", latitude: 5.4667, longitude: 95.2333 },
	{ name: "Pantai Ulee Lheue", slug: "pantai_ulee_lheue", latitude: 5.5583, longitude: 95.3083 },
	{ name: "Pantai Depok", slug: "pantai_depok", latitude: -8.0167, longitude: 110.3167 },
	{ name: "Pantai Samas", slug: "pantai_samas", latitude: -8.025, longitude: 110.3 },
	{ name: "Pantai Pangandaran", slug: "pantai_pangandaran", latitude: -7.6955, longitude: 108.653 },
	{ name: "Pantai Batu Karas", slug: "pantai_batu_karas", latitude: -7.7486, longitude: 108.4966 },
	{ name: "Pantai Bojongsalawe", slug: "pantai_bojongsalawe", latitude: -7.7033, longitude: 108.5275 },
];

async function seed() {
	initDb();
	const db = getDb();

	for (const beach of BEACHES) {
		const existing = await db
			.select()
			.from(schema.beaches)
			.where(eq(schema.beaches.slug, beach.slug))
			.limit(1);

		if (existing.length === 0) {
			await db.insert(schema.beaches).values(beach);
			console.log(`[seed] Inserted: ${beach.name}`);
		} else {
			console.log(`[seed] Already exists: ${beach.name}`);
		}
	}

	console.log("[seed] Done");
	process.exit(0);
}

seed().catch((err) => {
	console.error("[seed] Error:", err);
	process.exit(1);
});
