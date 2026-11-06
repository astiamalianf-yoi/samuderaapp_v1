import { Hono } from "hono";
import { redis } from "../lib/redis";
import { sendOpenClawReply } from "../lib/openclaw";
import {
	parseLaporCommand,
	parsePeringatanCommand,
	getMissingLocationMessage,
	getMissingSignsMessage,
	formatAlertsResponse,
	riskLabelFor,
} from "../lib/whatsapp-commands";

const route = new Hono();

type OpenClawWebhookEvent = {
	direction?: "incoming" | "outgoing";
	from?: string;
	to?: string;
	text?: string;
	messageId?: string;
	ack?: number;
};

const EXPERIMENT_ID_REGEX = /\[([A-Z0-9-]+)\]/;

async function handleLapor(text: string, chatId: string): Promise<string> {
	const result = parseLaporCommand(text);

	if (!result.ok) {
		if (result.missing === "location") return getMissingLocationMessage();
		return getMissingSignsMessage();
	}

	const params = new URLSearchParams({
		beach_location: result.beachLocation,
		lik_codes: result.likCodes.join(","),
		channel: "WA",
	});

	try {
		const res = await fetch(
			`http://localhost:3000/api/report/submit?${params.toString()}`,
		);
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
				`Pantai: ${result.beachLocation}`,
				`Jumlah pelapor: ${alertEvent.reporterCount}`,
				"Peringatan sedang dikirim ke semua nelayan.",
			].join("\n");
		}

		return [
			"✅ Laporan diterima, Bang!",
			`Tanda: ${result.likCodes.join(", ")}`,
			`Pantai: ${result.beachLocation}`,
			"Menunggu laporan lain untuk mencapai threshold.",
		].join("\n");
	} catch (err) {
		console.error("[openclaw-webhook] lapor fetch error:", err);
		return "Maaf Bang, gagal mengirim laporan. Coba lagi nanti ya.";
	}
}

async function handlePeringatan(text: string, chatId: string): Promise<string> {
	const beachFilter = parsePeringatanCommand(text);

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

route.post("/openclaw/webhook", async (c) => {
	try {
		const body = await c.req.json<OpenClawWebhookEvent>().catch(() => null);
		if (!body) {
			console.log("[openclaw-webhook] Invalid JSON body");
			return c.json({ success: false, error: "Invalid JSON" }, 400);
		}

		const { direction, from, to, text, messageId, ack } = body;
		console.log("[openclaw-webhook] Received event:", { direction, from, to, text: text?.substring(0, 100), messageId, ack });

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
				text,
				...(experimentId && { experimentId }),
			});

			console.log("[openclaw-webhook] Logged to whatsapp:incoming stream");

			const cleanText = text.replace(/@\d+\s*/, "").trim();
			const lowerText = cleanText.toLowerCase();
			const isCommand = lowerText.startsWith("!lapor") || lowerText.startsWith("!peringatan");
			const replyTarget = to || from;

			if (isCommand) {
				console.log(`[openclaw-webhook] Intercepted command: ${lowerText.substring(0, 50)}`);

				let reply: string;
				if (lowerText.startsWith("!lapor")) {
					reply = await handleLapor(cleanText, replyTarget);
				} else {
					reply = await handlePeringatan(cleanText, replyTarget);
				}

				await sendOpenClawReply(replyTarget, reply);
				console.log("[openclaw-webhook] Command handled, reply sent to:", replyTarget);

				return c.json({ success: true, handled: true, command: lowerText.startsWith("!lapor") ? "lapor" : "peringatan" });
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
