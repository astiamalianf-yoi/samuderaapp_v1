import { describe, expect, test } from "bun:test";
import { parseKejadianCommand } from "./whatsapp-commands";

describe("!kejadian / !tolong: what happened", () => {
	test("boat or gear problem is its own type, not a hazard", () => {
		expect(parseKejadianCommand("!tolong mesin mati di lampuuk").types).toEqual(["masalah_kapal"]);
		expect(parseKejadianCommand("!kejadian jaring tersangkut").types).toEqual(["masalah_kapal"]);
		expect(parseKejadianCommand("!kejadian angin kencang").types).toEqual(["angin_kencang"]);
	});
});
