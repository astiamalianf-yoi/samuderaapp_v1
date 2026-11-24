import { describe, expect, test } from "bun:test";
import { profileAnswers, profileSummary, profileViewEnabled, topReasons } from "./profile-view";
import type { FishermanProfile } from "./personal-warning";

const P = {
	age: 40, fishing_experience: 18, fishing_role: 1, head_of_community: 0, fishing_duration: 1,
	disaster_experience_count: 1, disaster_interaction: 3, lik_combination_count: 5, usage_duration: 18,
	usage_frequency_min: 8, usage_frequency_max: 12,
} as FishermanProfile;

describe("Profil Anda", () => {
	test("top reasons: the five largest SHAP values (top five, as in Paper 2), with their direction", () => {
		const top = topReasons({
			base_value: 0.5,
			contributions: { usage_frequency: 0.098, lik_combination_count: -0.092, disaster_interaction: 0.015, age: 0.012, fishing_role: -0.009, fishing_duration: 0.007, head_of_community: 0.001 },
		});
		expect(top).toEqual([
			{ key: "usage_frequency", push: "up", contribution: 0.098 },
			{ key: "lik_combination_count", push: "down", contribution: -0.092 },
			{ key: "disaster_interaction", push: "up", contribution: 0.015 },
			{ key: "age", push: "up", contribution: 0.012 },
			{ key: "fishing_role", push: "down", contribution: -0.009 },
		]);
	});

	test("summary: how many signs reach the threshold (the rule behind the colour)", () => {
		const s = profileSummary({ base_value: 0.4812, contributions: {} }, 0.62, { "Wn-1": 0.7, "Wn-2": 0.65, "Wn-3": 0.5, "Wn-4": null });
		expect(s).toEqual({ base: 0.481, mean: 0.62, signsUp: 2, signsTotal: 3, threshold: 0.6,
			perSign: [{ code: "Wn-1", p: 0.7 }, { code: "Wn-2", p: 0.65 }, { code: "Wn-3", p: 0.5 }] });
		expect(profileSummary(null, null, null)).toBeNull();
	});

	test("tiny contributions are not given as a reason; no explanation gives none", () => {
		expect(topReasons({ base_value: 0.5, contributions: { age: 0.001, fishing_role: -0.002 } })).toEqual([]);
		expect(topReasons(null)).toEqual([]);
	});

	test("all answers: usage frequency is one answer with its min and max", () => {
		const a = profileAnswers(P);
		expect(a).toHaveLength(10);
		expect(a[0]).toEqual({ key: "usage_frequency", value: 10, min: 8, max: 12 });
		expect(a.find((x) => x.key === "lik_combination_count")!.value).toBe(5);
	});

	test("shown by default, hidden only with PROFILE_CLASS_VISIBLE=false", () => {
		const old = process.env.PROFILE_CLASS_VISIBLE;
		delete process.env.PROFILE_CLASS_VISIBLE;
		expect(profileViewEnabled()).toBe(true);
		process.env.PROFILE_CLASS_VISIBLE = "false";
		expect(profileViewEnabled()).toBe(false);
		if (old === undefined) delete process.env.PROFILE_CLASS_VISIBLE; else process.env.PROFILE_CLASS_VISIBLE = old;
	});
});
