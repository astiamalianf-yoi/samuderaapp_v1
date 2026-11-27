import { describe, expect, test } from "bun:test";
// @ts-expect-error -- the real file, not other tests' mocks
const S = (await import("./bmkg-sim.ts?real-sim")) as typeof import("./bmkg-sim");
// @ts-expect-error -- the real file
const N = (await import("./bmkg-nowcast.ts?real-sim")) as typeof import("./bmkg-nowcast");

const warn = (o: Partial<import("./bmkg-sim").SimWarning>) => ({
	id: "sim-1", event: "Hujan Lebat", headline: "SIMULASI UAT", description: "SIMULASI UAT", areaDesc: "",
	effective: Date.now(), expires: Date.now() + 3600_000, ...o,
});
const covers = (w: ReturnType<typeof warn>) =>
	Object.keys(N.BEACH_AREA).filter((b) => N.capAppliesToBeach(b, N.parseCap(S.simWarningCap(w))!));

describe("BMKG test switch", () => {
	test("simulated forecast follows the BMKG table thresholds", () => {
		expect(S.simulatedBmkgData("pantai_lampuuk", { windSpeed: 35, expiresAt: 0 }).isSafe).toBe(false);
		expect(S.simulatedBmkgData("pantai_lampuuk", { windSpeed: 10, expiresAt: 0 }).isSafe).toBe(true);
		expect(S.simulatedBmkgData("pantai_lampuuk", { windSpeed: 10, forecast: "rain", expiresAt: 0 }).isSafe).toBe(false);
	});

	test("a simulated warning is matched to beaches with the real CAP rules", () => {
		expect(covers(warn({ areaDesc: "Kec. Lhoknga, Kab. Aceh Besar, Aceh" })).sort()).toEqual(["pantai_lampuuk", "pantai_lhoknga"]);
		expect(covers(warn({ areaDesc: "Kec. Meuraxa, Kota Banda Aceh, Aceh" }))).toEqual(["pantai_ulee_lheue"]);
		expect(covers(warn({ areaDesc: "Kab. Aceh Barat, Aceh" }))).toEqual([]);
		expect(covers(warn({ areaDesc: "Kab. Pangandaran, Jawa Barat" }))).toContain("pantai_pangandaran");
	});

	test("the CAP and RSS carry the simulation label and a link to the API", () => {
		const w = warn({ areaDesc: "Kab. Aceh Besar" });
		expect(S.simWarningCap(w)).toContain("<status>Exercise</status>");
		expect(S.simWarningsRss([w], "https://api.example")).toContain("https://api.example/api/bmkg/sim/cap/sim-1");
	});
});
