import { describe, test, expect } from "bun:test";
import { BEACH_THRESHOLDS, REPORT_THRESHOLD } from "./config";

describe("report threshold", () => {
	test("one report is enough by default, for every beach", () => {
		expect(REPORT_THRESHOLD).toBe(1);
		expect(BEACH_THRESHOLDS["pantai_lampuuk"]).toBeUndefined();
	});

	test("REPORT_THRESHOLD and REPORT_THRESHOLD_BEACHES raise it again", () => {
		const out = Bun.spawnSync(["bun", "-e", "const c = await import('./src/config.ts'); console.log(JSON.stringify([c.REPORT_THRESHOLD, c.BEACH_THRESHOLDS]))"], {
			env: { ...process.env, REPORT_THRESHOLD: "5", REPORT_THRESHOLD_BEACHES: "pantai_lampuuk=3, pantai_lhoknga=0, bad" },
		});
		expect(JSON.parse(out.stdout.toString().trim().split("\n").pop()!)).toEqual([5, { pantai_lampuuk: 3 }]);
	});
});
