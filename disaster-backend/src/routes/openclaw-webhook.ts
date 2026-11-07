import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { redis } from "../lib/redis";
import { beachForGroup, sendOpenClawReply } from "../lib/openclaw";
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
import { saveIncident } from "../lib/incident-store";
import { holdForRegistration } from "../lib/wa-sync";
import { recordClass } from "../lib/class-history";

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
		"Butuh bantuan? Telepon Basarnas *115* atau *112*.",
		...syncNote({ registered: Boolean(fisherman) }, sender),
	].join("\n");
}

async function handleLapor(text: string, chatId: string, sender?: string): Promise<string> {
	let result = parseLaporCommand(text);
	// In a beach group, a report without a beach name is about that group's beach.
	const groupBeach = beachForGroup(chatId);
	if (!result.ok && result.missing === "location" && groupBeach) {
		result = parseLaporCommand(`${text} ${groupBeach.replace(/_/g, " ")}`);
	}

	if (!result.ok) {
		if (result.missing === "location") return getMissingLocationMessage();
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

			return [
				"✅ Laporan diterima, Bang!",
				`⚠️ THRESHOLD TERLAMPAUI — ${riskLabel}`,
				`Pantai: ${beachName}`,
				`Jumlah pelapor: ${alertEvent.reporterCount}`,
				"Peringatan sedang dikirim ke semua nelayan.",
				...syncNote(data, sender),
			].join("\n");
		}

		const duplicates: string[] = Array.isArray(data.duplicateCodes) ? data.duplicateCodes : [];
		const counts: Record<string, number> = data.reportCounts ?? {};
		const threshold = Number(data.threshold) || 5;
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
		].join("\n");
	} catch (err) {
		console.error("[openclaw-webhook] lapor fetch error:", err);
		return "Maaf Bang, gagal mengirim laporan. Coba lagi nanti ya.";
	}
}

async function handlePeringatan(text: string, chatId: string): Promise<string> {
	// In a beach group, "!peringatan" alone shows that beach only, never the neighbours'.
	const beachFilter = parsePeringatanCommand(text) ?? beachForGroup(chatId);

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
	if (!hookTokenOk(c.req.raw.headers)) return c.json({ success: false, error: "unauthorized" }, 401);
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

			const cleanText = text.replace(/@\d+\s*/, "").trim();
			const lowerText = cleanText.toLowerCase();
			const command = lowerText.startsWith("!lapor") ? "lapor"
				: lowerText.startsWith("!kejadian") ? "kejadian"
				: lowerText.startsWith("!peringatan") ? "peringatan" : null;
			const isCommand = command !== null;
			const replyTarget = to || from;

			if (isCommand && (await isRepeatedMessage(messageId))) {
				console.log("[openclaw-webhook] Same message delivered again, ignored:", messageId);
				return c.json({ success: true, handled: false, duplicate: true });
			}

			if (isCommand) {
				console.log(`[openclaw-webhook] Intercepted command: ${lowerText.substring(0, 50)}`);

				let reply: string;
				if (command === "lapor") {
					reply = await handleLapor(cleanText, replyTarget, sender);
				} else if (command === "kejadian") {
					reply = await handleKejadian(cleanText, sender, replyTarget);
				} else {
					reply = await handlePeringatan(cleanText, replyTarget);
				}

				await sendOpenClawReply(replyTarget, reply);
				console.log("[openclaw-webhook] Command handled, reply sent to:", replyTarget);

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
