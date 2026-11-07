import { describe, expect, test } from "bun:test";
// @ts-expect-error -- the real file, not other tests' mocks of "../lib/openclaw"
const O = (await import("./openclaw.ts?real-groups")) as typeof import("./openclaw");
// @ts-expect-error -- the real file
const { buildMorningMessage, isWarningLevel } = (await import("../routes/broadcast-morning.ts?real-groups")) as typeof import("../routes/broadcast-morning");
// @ts-expect-error -- the real file
const { formatNowcastWhatsApp } = (await import("./bmkg-nowcast.ts?real-groups")) as typeof import("./bmkg-nowcast");

const perBeach = {
	beachGroups: { pantai_lampuuk: ["G-LAMPUUK"], pantai_lhoknga: ["G-LHOKNGA"], pantai_ulee_lheue: ["G-ULEE"] },
	broadcast: ["G-OLD-SHARED"],
};
const shared = { beachGroups: {}, broadcast: ["G-A", "G-B"] };

describe("one WhatsApp group per beach", () => {
	test("a beach's warning goes only to its own group, never to the neighbours", () => {
		expect(O.groupsForBeach("pantai_lampuuk", perBeach)).toEqual(["G-LAMPUUK"]);
		expect(O.groupsForBeach("pantai_lhoknga", perBeach)).toEqual(["G-LHOKNGA"]);
	});

	test("a beach without a group gets nothing (not the shared group)", () => {
		expect(O.groupsForBeach("pantai_depok", perBeach)).toEqual([]);
	});

	test("without per-beach groups, the old shared broadcast groups are used", () => {
		expect(O.groupsForBeach("pantai_lampuuk", shared)).toEqual(["G-A", "G-B"]);
		expect(O.allGroups(shared)).toEqual(["G-A", "G-B"]);
	});

	test("a BMKG warning for two beaches: each group gets it, naming only its own beach", () => {
		const m = O.beachesByGroup(["pantai_lampuuk", "pantai_lhoknga"], perBeach);
		expect([...m.entries()]).toEqual([["G-LAMPUUK", ["pantai_lampuuk"]], ["G-LHOKNGA", ["pantai_lhoknga"]]]);
		const w = { id: "x", event: "Hujan lebat dan angin kencang", headline: "", description: "…", effective: 0, expires: Date.parse("2026-11-07T12:00:00Z") };
		const toLampuuk = formatNowcastWhatsApp(w, m.get("G-LAMPUUK")!);
		expect(toLampuuk).toContain("Lampuuk");
		expect(toLampuuk).not.toContain("Lhoknga");
	});

	test("the group's own beach is known (commands without a beach name)", () => {
		expect(O.beachForGroup("G-ULEE", perBeach)).toBe("pantai_ulee_lheue");
		expect(O.beachForGroup("G-OLD-SHARED", perBeach)).toBeNull();
		expect(O.beachForGroup(undefined, perBeach)).toBeNull();
	});
});

describe("morning message per group", () => {
	const alert = (beach: string, level: string) => ({
		alertId: "a", beachLocation: beach, riskLevel: level, reporterCount: 5, firstReportAt: 0, lastReportAt: 0,
		serverTimestamp: 0, actionRecommendation: "Tunda melaut", signDescription: "Kilat", triggeredCodes: ["Wn-3"], communityCharacteristics: "",
	});
	test("Lhoknga's group does not see Lampuuk's warning", () => {
		const msg = buildMorningMessage(["pantai_lhoknga"], [alert("pantai_lampuuk", "siaga")], null, null);
		expect(msg).not.toContain("Lampuuk");
		expect(msg).toContain("Cuaca aman di Pantai Lhoknga");
	});
	test("a SIAGA or WASPADA warning is shown (not only the old 'unsafe' names)", () => {
		expect(isWarningLevel("siaga")).toBe(true);
		expect(isWarningLevel("waspada")).toBe(true);
		expect(isWarningLevel("aman")).toBe(false);
		const msg = buildMorningMessage(["pantai_lhoknga"], [alert("pantai_lhoknga", "siaga")], null, null);
		expect(msg).toContain("PERINGATAN");
	});
});
