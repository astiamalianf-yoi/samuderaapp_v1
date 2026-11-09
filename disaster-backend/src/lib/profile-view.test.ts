import { describe, expect, test } from "bun:test";
import { profileAnswers, profileViewEnabled, topReasons } from "./profile-view";
import type { FishermanProfile } from "./personal-warning";

const P = {
	age: 40, fishing_experience: 18, fishing_role: 1, head_of_community: 0, fishing_duration: 1,
	disaster_experience_count: 1, disaster_interaction: 3, lik_combination_count: 5, usage_duration: 18,
	usage_frequency_min: 8, usage_frequency_max: 12,
} as FishermanProfile;

describe("Profil Anda", () => {
	test("top reasons: the three largest SHAP values, with their direction", () => {
		const top = topReasons({
			base_value: 0.5,
			contributions: { usage_frequency: 0.098, lik_combination_count: -0.092, disaster_interaction: 0.015, age: 0.012, fishing_role: -0.001 },
		});
		expect(top).toEqual([
			{ key: "usage_frequency", push: "up" },
			{ key: "lik_combination_count", push: "down" },
			{ key: "disaster_interaction", push: "up" },
		]);
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
