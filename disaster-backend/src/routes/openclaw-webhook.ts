import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { redis } from "../lib/redis";
import { beachForGroup, groupsForBeach, sendOpenClawBeachAlert, sendOpenClawReply } from "../lib/openclaw";
import { formatHelpMessage } from "./incidents";
import {
	parseLaporCommand,
	parsePeringatanCommand,
	getMissingLocationMessage,
	getMissingSignsMessage,
	formatAlertsResponse,
	riskLabelFor,
	signLabel,
	BEACH_DISPLAY,
	parseKejadianCommand,
	INCIDENT_NAMES,
} from "../lib/whatsapp-commands";
import { INTERNAL_REQUEST_SECRET, OPENCLAW_HOOK_TOKEN } from "../config";
import { findFishermanByPhone, normalizePhone, phoneHash } from "../lib/fishermen";
import { recordEvent } from "../lib/app-events";
import { saveIncident } from "../lib/incident-store";
import { holdForRegistration } from "../lib/wa-sync";
import { recordClass } from "../lib/class-history";
import { RESPONSES, answerCrossCheck, answerFollowup, crossCheckFor, parseAngin, parseTindakan, pendingFollowup, whatsappFollowupPrompt } from "../lib/report-followup";

const route = new Hono();

type OpenClawWebhookEvent = {
	direction?: "incoming" | "outgoing";
	from?: string;
	/** The person who wrote it (his number, from OpenClaw metadata.senderE164); `from` may be the group id. */
	sender?: string;
	to?: string;
	text?: string;
	messageId?: string;
	ack?: number;
};

const EXPERIMENT_ID_REGEX = /\[([A-Z0-9-]+)\]/;

/** A WhatsApp message id seen within this time is a re-delivery of the same message. */
const MESSAGE_DEDUPE_TTL_SECONDS = 60 * 60;

export async function isRepeatedMessage(messageId: string | undefined): Promise<boolean> {
	if (!messageId) return false;
	const fresh = await redis.set(`whatsapp:seen:${messageId}`, "1", { NX: true, EX: MESSAGE_DEDUPE_TTL_SECONDS });
	return fresh !== "OK";
}

/** Who wrote the message: the relay's sender field, else `from` unless that is the group id. */
export function senderOf(body: { sender?: string; from?: string }): string | undefined {
	for (const v of [body.sender, body.from]) {
		if (typeof v === "string" && v.trim() && !/@g\.us$/i.test(v.trim())) return v.trim();
	}
	return undefined;
}

const masked = (v?: string) => {
	const d = normalizePhone(v);
	return d ? `…${d.slice(-4)}` : v ? "(not a phone number)" : "(none)";
};

/** Line added to a receipt when the report could not be put in a fisherman's own history. */
function syncNote(data: { registered?: boolean; heldForRegistration?: boolean }, sender?: string): string[] {
	if (data.registered) return [];
	if (data.heldForRegistration || normalizePhone(sender)) {
		return ["ℹ️ Nomor ini belum terdaftar. Daftar di aplikasi SAMUDRA dengan nomor WhatsApp ini, laporan Anda akan masuk ke profil Anda."];
	}
	return ["ℹ️ Nomor pengirim tidak terbaca, laporan dihitung tetapi belum masuk ke profil Anda."];
}

async function handleKejadian(text: string, sender?: string, chatId?: string): Promise<string> {
	const parsed = parseKejadianCommand(text);
	if (parsed.types.length === 0) {
		return "Kejadian apa, Bang? Contoh: *!kejadian angin kencang di lampuuk* (angin kencang, gelombang besar, badai, arus kuat).";
	}
	const fisherman = findFishermanByPhone(sender);
	const beach = parsed.beachLocation ?? beachForGroup(chatId) ?? fisherman?.homeBeach ?? null;
	if (!beach) return "Di pantai mana, Bang? Contoh: *!kejadian angin kencang di lampuuk*";
	const names = parsed.types.map((t) => INCIDENT_NAMES[t] ?? t).join(", ");
	const beachName = BEACH_DISPLAY[beach] ?? beach;
	if (fisherman) {
		for (const type of parsed.types) saveIncident({ fishermanId: fisherman.id, beach, type, channel: "WHATSAPP" });
		void recordClass(fisherman, "incident");
	} else {
		for (const type of parsed.types) holdForRegistration(sender, "incident", beach, { type });
	}
	return [
		"✅ Kejadian dicatat, Bang. Hati-hati di laut.",
		`Kejadian: ${names}`,
		`Pantai: ${beachName}`,
		"Butuh bantuan dari nelayan lain? Kirim *!tolong*. Darurat: Basarnas *115* atau *112*.",
		...syncNote({ registered: Boolean(fisherman) }, sender),
	].join("\n");
}

/** "!tolong", "!bantu", "!sos", or "!kejadian … tolong/bantu": a call for help. */
export const isHelpCommand = (lower: string) =>
	/^!(tolong|tlg|bantu|bantuan|sos)\b/.test(lower) || (/^!kejadian\b/.test(lower) && /\b(tolong|tlg|bantu|bantuan|sos)\b/.test(lower));

/** One call for help per number per 10 minutes (repeated in panic are sent once), as in the app. */
const HELP_COOLDOWN_SECONDS = 10 * 60;

/**
 * Call for help on WhatsApp: the help message goes to the WhatsApp group of the beach (same text
 * as the app's "Minta bantuan" page), the incident is recorded, and the sender is asked
 * to share his location in that group (the bot cannot read a shared location).
 */
export async function handleHelp(text: string, sender?: string, chatId?: string): Promise<string> {
	const parsed = parseKejadianCommand(text.replace(/^!(tolong|tlg|bantu|bantuan|sos)\b/i, "!kejadian"));
	const fisherman = findFishermanByPhone(sender);
	const beach = parsed.beachLocation ?? defaultBeachFor(chatId, sender);
	if (!beach) return "🆘 Di pantai mana, Bang? Contoh: *!tolong angin kencang di lampuuk*\nDarurat: Basarnas *115* atau *112*.";
	const beachName = BEACH_DISPLAY[beach] ?? beach;
	const type = (parsed.types[0] ?? null) as Parameters<typeof formatHelpMessage>[0]["type"];
	if (fisherman) {
		for (const t of parsed.types) saveIncident({ fishermanId: fisherman.id, beach, type: t, channel: "WHATSAPP", needHelp: true });
		if (parsed.types.length) void recordClass(fisherman, "incident");
	} else {
		for (const t of parsed.types) holdForRegistration(sender, "incident", beach, { type: t });
	}
	if (groupsForBeach(beach).length === 0) {
		return `🆘 ${beachName} belum punya grup WhatsApp SAMUDRA, jadi pesan bantuan tidak bisa dikirim ke nelayan lain.\nDarurat: telepon Basarnas *115* atau *112* sekarang.`;
	}
	const phone = normalizePhone(sender);
	const key = `incident:help:wa:${phone ? phoneHash(phone) : chatId ?? "unknown"}`;
	const fresh = await redis.set(key, "1", { NX: true, EX: HELP_COOLDOWN_SECONDS }).catch(() => "OK");
	if (fresh !== "OK") {
		return `🆘 Permintaan bantuan Anda sudah dikirim ke grup ${beachName} beberapa menit lalu.\nDarurat: Basarnas *115* atau *112*.`;
	}
	try {
		await sendOpenClawBeachAlert(beach, formatHelpMessage({ beach, type, phone, locationStatus: "via_whatsapp" }));
	} catch {
		return "🆘 Pesan bantuan belum terkirim ke grup. Telepon Basarnas *115* atau *112* sekarang.";
	}
	return [
		`🆘 Permintaan bantuan dikirim ke grup ${beachName}.`,
		"📍 Bagikan lokasi Anda di grup itu: tekan 📎 atau ➕, lalu *Lokasi*.",
		"📞 Darurat: Basarnas *115* atau *112*.",
	].join("\n");
}

/** A WhatsApp group chat (…@g.us), as opposed to a private chat with the bot. */
export const isGroupChat = (chatId?: string) => typeof chatId === "string" && /@g\.us$/i.test(chatId.trim());

/**
 * Which beach a report without a beach name is about: the beach of the group it was sent in,
 * else (private chat) the beach in the sender's registration. Null: we must ask him.
 */
export function defaultBeachFor(chatId: string | undefined, sender: string | undefined, lookup = findFishermanByPhone): string | null {
	return beachForGroup(chatId) ?? lookup(sender)?.homeBeach ?? null;
}

/** Asked in a private chat when an unregistered number reports without a beach name. */
export const PRIVATE_MISSING_BEACH =
	"Di pantai mana, Bang? Tulis nama pantainya, contoh: *!lapor awan hitam lampuuk*\n" +
	"ℹ️ Daftar di aplikasi SAMUDRA dengan nomor WhatsApp ini, supaya lain kali pantai Anda terisi otomatis.";

/** Added to the private receipt of a report that was sent in a beach group. */
export const FROM_GROUP_NOTE =
	"ℹ️ Laporan Anda dari grup. Lain kali kirim *!lapor* di chat pribadi ini saja, supaya grup tetap untuk peringatan dan minta tolong.";

async function handleLapor(text: string, chatId: string, sender?: string): Promise<string> {
	let result = parseLaporCommand(text);
	// No beach name: the group's beach, or (private chat) the beach in his registration.
	const fallbackBeach = !result.ok && result.missing === "location" ? defaultBeachFor(chatId, sender) : null;
	if (fallbackBeach) {
		result = parseLaporCommand(`${text} ${fallbackBeach.replace(/_/g, " ")}`);
	}

	if (!result.ok) {
		if (result.missing === "location") return isGroupChat(chatId) ? getMissingLocationMessage() : PRIVATE_MISSING_BEACH;
		return getMissingSignsMessage();
	}

	const beachName = BEACH_DISPLAY[result.beachLocation] ?? result.beachLocation;
	const signText = result.likCodes.map((code) => `${signLabel(code)} (${code})`).join(", ");
	const params = new URLSearchParams({
		beach_location: result.beachLocation,
		lik_codes: result.likCodes.join(","),
		channel: "WA",
	});
	if (sender) params.set("reporter", sender);

	try {
		const res = await fetch(`http://localhost:3000/api/report/submit?${params.toString()}`, {
			headers: { "X-Internal-Key": INTERNAL_REQUEST_SECRET },
		});
		const data = (await res.json()) as any;

		if (!res.ok || !data.ok) {
			return `Gagal mengirim laporan: ${data.error || res.statusText}. Coba lagi ya, Bang.`;
		}

		if (data.status === "triggered") {
			const alertEvent = data.alertEvent;
			const riskLabel = riskLabelFor(alertEvent.riskLevel);

			const notified = alertEvent.decision?.notify !== false;
			return [
				"✅ Laporan diterima, Bang!",
				`Tanda: ${signText}`,
				`Pantai: ${beachName}`,
				notified
					? `⚠️ Peringatan ${riskLabel} dikirim ke grup (dilaporkan oleh ${alertEvent.reporterCount} nelayan).`
					: `ℹ️ Peringatan ${riskLabel} untuk pantai ini masih berlaku. Laporan Anda ikut memperpanjangnya, tanpa pesan baru ke grup.`,
				...syncNote(data, sender),
				...followupLines(data, sender),
			].join("\n");
		}

		const duplicates: string[] = Array.isArray(data.duplicateCodes) ? data.duplicateCodes : [];
		const counts: Record<string, number> = data.reportCounts ?? {};
		const threshold = Number(data.threshold) || 1;
		const countedCodes = result.likCodes.filter((code) => !duplicates.includes(code));

		if (countedCodes.length === 0) {
			return [
				"ℹ️ Laporan ini sudah tercatat, Bang.",
				`Tanda: ${signText}`,
				`Pantai: ${beachName}`,
				"Laporan yang sama dari nomor yang sama dalam 5 menit dihitung satu kali.",
				...syncNote(data, sender),
			].join("\n");
		}

		return [
			"✅ Laporan diterima, Bang!",
			`Tanda: ${signText}`,
			`Pantai: ${beachName}`,
			...countedCodes.map((code) => `Laporan ${code}: ${counts[code] ?? 1} dari ${threshold}`),
			...(duplicates.length > 0
				? [`(${duplicates.join(", ")} sudah Anda laporkan dalam 5 menit terakhir, tidak dihitung lagi)`]
				: []),
			"Menunggu laporan lain untuk mencapai threshold.",
			...syncNote(data, sender),
			...followupLines(data, sender),
		].join("\n");
	} catch (err) {
		console.error("[openclaw-webhook] lapor fetch error:", err);
		return "Maaf Bang, gagal mengirim laporan. Coba lagi nanti ya.";
	}
}

/** The two follow-up questions under the receipt of a registered fisherman's report. */
function followupLines(data: { registered?: boolean }, sender?: string): string[] {
	if (!data.registered) return [];
	const f = findFishermanByPhone(sender);
	const p = f ? pendingFollowup(f.id) : null;
	return p ? whatsappFollowupPrompt(p) : [];
}

const NO_OPEN_REPORT = "ℹ️ Tidak ada laporan tanda alam di pantai Anda dalam 24 jam terakhir, Bang. Kirim *!lapor* jika melihat tanda alam, atau *!kejadian* jika ada bahaya.";
const NOT_REGISTERED = "ℹ️ Nomor ini belum terdaftar. Daftar di aplikasi SAMUDRA dengan nomor WhatsApp ini, supaya jawaban Anda tercatat.";

/** "!tindakan 3": what he did after the sign he reported (within 24 h). */
export function handleTindakan(text: string, sender?: string): string {
	const f = findFishermanByPhone(sender);
	if (!f) return NOT_REGISTERED;
	const value = parseTindakan(text);
	if (!value) {
		return ["Apa yang Anda lakukan, Bang? Balas *!tindakan* dan nomornya:",
			...Object.values(RESPONSES).map((v, i) => `   ${i + 1}. ${v}`)].join("\n");
	}
	const res = answerFollowup({ fishermanId: f.id, kind: "response", value, channel: "WHATSAPP" });
	if (!res.ok) return res.error === "already_answered" ? "ℹ️ Tindakan untuk laporan ini sudah tercatat, Bang." : NO_OPEN_REPORT;
	return [`✅ Terima kasih, Bang. Tindakan dicatat: ${RESPONSES[value]}.`,
		...(res.pending?.needHazard ? ["Angin kencang datang? Balas *!angin ya* atau *!angin tidak*"] : [])].join("\n");
}

/** "!angin ya" (an incident: strong wind at the beach of his report) or "!angin tidak". */
export function handleAngin(text: string, sender?: string): string {
	const f = findFishermanByPhone(sender);
	if (!f) return NOT_REGISTERED;
	const value = parseAngin(text);
	if (!value) return "Angin kencang datang, Bang? Balas *!angin ya* atau *!angin tidak*";
	const p = pendingFollowup(f.id);
	if (!p) {
		// Not his own report: the cross-check of his home beach (asked in the app, answerable here).
		const cc = crossCheckFor(f.id, f.homeBeach);
		if (!cc) return NO_OPEN_REPORT;
		const name = BEACH_DISPLAY[cc.beach] ?? cc.beach;
		if (value === "came") {
			saveIncident({ fishermanId: f.id, beach: cc.beach, type: "angin_kencang", channel: "WHATSAPP" });
			void recordClass(f, "incident");
			return [
				"✅ Kejadian dicatat, Bang. Hati-hati di laut.",
				`Kejadian: ${INCIDENT_NAMES.angin_kencang}`,
				`Pantai: ${name}`,
				"Butuh bantuan dari nelayan lain? Kirim *!tolong*. Darurat: Basarnas *115* atau *112*.",
			].join("\n");
		}
		answerCrossCheck({ fishermanId: f.id, beach: cc.beach, channel: "WHATSAPP" });
		return `✅ Terima kasih, Bang. Dicatat: tidak ada angin kencang di ${name}.`;
	}
	if (!p.needHazard) return "ℹ️ Jawaban untuk laporan ini sudah tercatat, Bang.";
	const beachName = BEACH_DISPLAY[p.beach] ?? p.beach;
	if (value === "came") {
		// The same as "!kejadian angin kencang": an incident, which also answers the question.
		saveIncident({ fishermanId: f.id, beach: p.beach, type: "angin_kencang", channel: "WHATSAPP" });
		void recordClass(f, "incident");
		return [
			"✅ Kejadian dicatat, Bang. Hati-hati di laut.",
			`Kejadian: ${INCIDENT_NAMES.angin_kencang}`,
			`Pantai: ${beachName}`,
			"Butuh bantuan dari nelayan lain? Kirim *!tolong*. Darurat: Basarnas *115* atau *112*.",
			...(p.needResponse ? ["Apa yang Anda lakukan? Balas *!tindakan* dan nomornya (1–5)."] : []),
		].join("\n");
	}
	const res = answerFollowup({ fishermanId: f.id, kind: "hazard", value: "not_came", channel: "WHATSAPP", reportId: p.reportId });
	if (!res.ok) return NO_OPEN_REPORT;
	return ["✅ Terima kasih, Bang. Dicatat: angin kencang tidak datang.",
		...(res.pending?.needResponse ? ["Apa yang Anda lakukan? Balas *!tindakan* dan nomornya (1–5)."] : [])].join("\n");
}

async function handlePeringatan(text: string, chatId: string, sender?: string): Promise<string> {
	// "!peringatan" alone: the group's beach, or (private chat) the beach in his registration.
	const beachFilter = parsePeringatanCommand(text) ?? defaultBeachFor(chatId, sender);

	try {
		const params = beachFilter ? `?beach_location=${beachFilter}` : "";
		const res = await fetch(`http://localhost:3000/api/alerts${params}`);
		const data = (await res.json()) as any;

		if (!res.ok || !data.ok) {
			return `Gagal mengambil peringatan: ${data.error || res.statusText}. Coba lagi ya, Bang.`;
		}

		return formatAlertsResponse(data.data || [], beachFilter);
	} catch (err) {
		console.error("[openclaw-webhook] peringatan fetch error:", err);
		return "Maaf Bang, gagal mengambil info peringatan. Coba lagi nanti ya.";
	}
}

/**
 * Only our OpenClaw may post here: with OPENCLAW_HOOK_TOKEN set, the relay hook must send it
 * (X-Hook-Token or Authorization: Bearer). Otherwise anyone could post fake group messages
 * "from" a registered fisherman and change his profile or the Trust Index.
 */
export function hookTokenOk(headers: { get(name: string): string | null }, expected = OPENCLAW_HOOK_TOKEN): boolean {
	if (!expected) return true;
	const given = headers.get("x-hook-token") ?? headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
if (!OPENCLAW_HOOK_TOKEN) console.warn("[openclaw-webhook] OPENCLAW_HOOK_TOKEN is not set: the webhook accepts posts from anyone");

route.post("/openclaw/webhook", async (c) => {
	if (!hookTokenOk(c.req.raw.headers)) {
		// Say why (never the token itself), so a relay posting without or with the wrong token is visible.
		const sent = c.req.raw.headers.get("x-hook-token") ?? c.req.raw.headers.get("authorization");
		console.warn(`[openclaw-webhook] Refused post: ${sent ? "wrong hook token" : "no hook token"} (check BACKEND_WEBHOOK_TOKEN in openclaw.json)`);
		return c.json({ success: false, error: "unauthorized" }, 401);
	}
	try {
		const body = await c.req.json<OpenClawWebhookEvent>().catch(() => null);
		if (!body) {
			console.log("[openclaw-webhook] Invalid JSON body");
			return c.json({ success: false, error: "Invalid JSON" }, 400);
		}

		const { direction, from, to, text, messageId, ack } = body;
		const sender = senderOf(body);
		console.log("[openclaw-webhook] Received event:", { direction, from, sender: masked(sender), to, text: text?.substring(0, 100), messageId, ack });

		if (!direction) {
			console.log("[openclaw-webhook] Missing direction");
			return c.json({ success: false, error: "Missing direction" }, 400);
		}

		const timestamp = Date.now();
		let experimentId: string | null = null;

		if (text) {
			const match = text.match(EXPERIMENT_ID_REGEX);
			if (match && match[1]) {
				experimentId = match[1];
				console.log("[openclaw-webhook] Extracted experimentId:", experimentId);
			}
		}

		if (direction === "incoming") {
			if (!from || !text) {
				console.log("[openclaw-webhook] Missing required fields for incoming");
				return c.json({ success: false, error: "Missing from or text" }, 400);
			}

			await redis.xAdd("whatsapp:incoming", "*", {
				timestamp: String(timestamp),
				from,
				// Keyed hash of the sender's number (not the number), to link the message to his history.
				...(normalizePhone(sender) ? { senderHash: phoneHash(normalizePhone(sender)!) } : {}),
				text,
				...(experimentId && { experimentId }),
			});

			console.log("[openclaw-webhook] Logged to whatsapp:incoming stream");

			// "LAPOR" alone (from the wa.me link in a group warning) starts a report, like "!lapor".
			const rawText = text.replace(/@\d+\s*/, "").trim();
			const cleanText = /^lapor[.!]?$/i.test(rawText) ? "!lapor" : rawText;
			const lowerText = cleanText.toLowerCase();
			const command = isHelpCommand(lowerText) ? "tolong"
				: lowerText.startsWith("!lapor") ? "lapor"
				: lowerText.startsWith("!kejadian") ? "kejadian"
				: lowerText.startsWith("!peringatan") ? "peringatan"
				: lowerText.startsWith("!tindakan") ? "tindakan"
				: lowerText.startsWith("!angin") ? "angin" : null;
			const isCommand = command !== null;
			const replyTarget = to || from;

			if (isCommand && (await isRepeatedMessage(messageId))) {
				console.log("[openclaw-webhook] Same message delivered again, ignored:", messageId);
				return c.json({ success: true, handled: false, duplicate: true });
			}

			if (isCommand) {
				console.log(`[openclaw-webhook] Intercepted command: ${lowerText.substring(0, 50)}`);
				// Usage log (field study): a registered fisherman used the bot today.
				try {
					const user = findFishermanByPhone(sender);
					if (user) recordEvent({ fishermanId: user.id, event: "wa_command", ref: command ?? "", beach: user.homeBeach, channel: "WHATSAPP" });
				} catch (err) {
					console.warn("[openclaw-webhook] usage log failed:", err);
				}

				let reply: string;
				let target = replyTarget;
				if (command === "lapor") {
					reply = await handleLapor(cleanText, replyTarget, sender);
					// A report sent in a group: the receipt goes to him privately, so the group stays
					// for warnings and calls for help. The warning itself still goes to the group.
					const phone = normalizePhone(sender);
					if (isGroupChat(replyTarget) && phone) {
						target = `+${phone}`;
						reply = `${reply}\n${FROM_GROUP_NOTE}`;
					}
				} else if (command === "tolong") {
					reply = await handleHelp(cleanText, sender, replyTarget);
					// The call for help itself goes to the group; the instructions go to him privately.
					const phone = normalizePhone(sender);
					if (isGroupChat(replyTarget) && phone) target = `+${phone}`;
				} else if (command === "kejadian") {
					reply = await handleKejadian(cleanText, sender, replyTarget);
				} else if (command === "tindakan" || command === "angin") {
					reply = command === "tindakan" ? handleTindakan(cleanText, sender) : handleAngin(cleanText, sender);
					// His answers are his own: in a group, the reply goes to him privately.
					const phone = normalizePhone(sender);
					if (isGroupChat(replyTarget) && phone) target = `+${phone}`;
				} else {
					reply = await handlePeringatan(cleanText, replyTarget, sender);
				}

				await sendOpenClawReply(target, reply);
				console.log("[openclaw-webhook] Command handled, reply sent to:", target === replyTarget ? target : `private ${masked(target)}`);

				return c.json({ success: true, handled: true, command });
			}
		} else if (direction === "outgoing") {
			if (!to || !text) {
				console.log("[openclaw-webhook] Missing required fields for outgoing");
				return c.json({ success: false, error: "Missing to or text" }, 400);
			}

			await redis.xAdd("whatsapp:outgoing", "*", {
				timestamp: String(timestamp),
				to,
				text,
				...(experimentId && { experimentId }),
			});

			console.log("[openclaw-webhook] Logged to whatsapp:outgoing stream");
		} else if (direction === "ack") {
			if (!messageId || !from) {
				console.log("[openclaw-webhook] Missing required fields for ack");
				return c.json({ success: false, error: "Missing messageId or from" }, 400);
			}

			const ackLevel = ack ?? 0;

			await redis.xAdd("whatsapp:acks", "*", {
				timestamp: String(timestamp),
				messageId,
				chatId: from,
				ack: String(ackLevel),
				...(experimentId && { experimentId }),
			});

			console.log("[openclaw-webhook] Logged to whatsapp:acks stream, ack level:", ackLevel);
		} else {
			console.log("[openclaw-webhook] Unknown direction:", direction);
			return c.json({ success: false, error: "Unknown direction" }, 400);
		}

		return c.json({ success: true });
	} catch (error) {
		console.error("[openclaw-webhook] Error:", error);
		return c.json({ success: false, error: "Internal server error" }, 500);
	}
});

export default route;
