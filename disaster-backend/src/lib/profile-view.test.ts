import { describe, expect, test } from "bun:test";
import { profileFeatures, profileViewEnabled } from "./profile-view";
import type { FishermanProfile } from "./personal-warning";

const base = {
	fishing_experience: 10, fishing_role: 2, head_of_community: 1, fishing_duration: 1, lik_combination_count: 2,
} as const;
// P-A and P-I presets from the UAT plan (year 2026)
const PA = { ...base, age: 30, disaster_interaction: 6, usage_frequency_min: 12, usage_frequency_max: 20, usage_duration: 25, disaster_experience_count: 1 } as FishermanProfile;
const PI = { ...base, age: 55, disaster_interaction: 1, usage_frequency_min: 2, usage_frequency_max: 4, usage_duration: 8, disaster_experience_count: 4 } as FishermanProfile;

describe("Profil Anda: the five tipping points", () => {
	test("P-A is on the actionable side of all five", () => {
		const f = profileFeatures(PA);
		expect(f.map((x) => x.key)).toEqual(["disaster_interaction", "usage_frequency_avg", "age", "usage_duration", "disaster_experience_count"]);
		expect(f.every((x) => x.side === "actionable")).toBe(true);
		expect(f.find((x) => x.key === "usage_frequency_avg")!.value).toBe(16);
	});

	test("P-I is on the inaction side of all five", () => {
		expect(profileFeatures(PI).every((x) => x.side === "inaction")).toBe(true);
	});

	test("values exactly at a threshold follow the paper (<= / >= is the inaction side)", () => {
		const atLimit = { ...PA, age: 45, disaster_experience_count: 2, disaster_interaction: 1.5, usage_frequency_min: 4.75, usage_frequency_max: 4.75, usage_duration: 17.5 } as FishermanProfile;
		const s = Object.fromEntries(profileFeatures(atLimit).map((x) => [x.key, x.side]));
		expect(s).toEqual({ disaster_interaction: "inaction", usage_frequency_avg: "inaction", age: "actionable", usage_duration: "inaction", disaster_experience_count: "actionable" });
	});

	test("hidden unless PROFILE_CLASS_VISIBLE=true", () => {
		const old = process.env.PROFILE_CLASS_VISIBLE;
		delete process.env.PROFILE_CLASS_VISIBLE;
		expect(profileViewEnabled()).toBe(false);
		process.env.PROFILE_CLASS_VISIBLE = "true";
		expect(profileViewEnabled()).toBe(true);
		if (old === undefined) delete process.env.PROFILE_CLASS_VISIBLE; else process.env.PROFILE_CLASS_VISIBLE = old;
	});
});
