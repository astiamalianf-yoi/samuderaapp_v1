import { describe, expect, test } from "bun:test";
import { defaultBeachFor, isGroupChat, PRIVATE_MISSING_BEACH, FROM_GROUP_NOTE } from "./openclaw-webhook";

const registered = (phone?: string) => (phone === "+6281277000011" ? ({ homeBeach: "lhoknga" } as any) : null);

describe("private reports to the bot", () => {
	test("a group id is a group chat, a number is a private chat", () => {
		expect(isGroupChat("120363406080394106@g.us")).toBe(true);
		expect(isGroupChat("+6281277000011")).toBe(false);
		expect(isGroupChat(undefined)).toBe(false);
	});

	test("private chat: the beach comes from his registration", () => {
		expect(defaultBeachFor("+6281277000011", "+6281277000011", registered)).toBe("lhoknga");
	});

	test("private chat, not registered: no beach, so we ask", () => {
		expect(defaultBeachFor("+6281277000099", "+6281277000099", registered)).toBeNull();
		expect(PRIVATE_MISSING_BEACH).toContain("Di pantai mana");
		expect(PRIVATE_MISSING_BEACH).toContain("Daftar");
	});

	test("the group receipt note asks him to report privately next time", () => {
		expect(FROM_GROUP_NOTE).toContain("chat pribadi");
	});
});
