import { Hono } from "hono";
import { websocket } from "hono/bun";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { initRedis, sub } from "./lib/redis";
import { initDb } from "./db";
import { initWebPush, sendPushAlertToAll } from "./lib/push";
import {
	ALERTS_CHANNEL,
	CORS_ALLOWED_ORIGINS,
	ENABLE_PUSH_DELIVERY,
	ENABLE_SSE_DELIVERY,
	ENABLE_WS_DELIVERY,
	PORT,
} from "./config";
import healthRoute from "./routes/health";
import sseRoute, { sseClients } from "./routes/sse";
import wsRoute, { wsClients } from "./routes/ws";
import pushRoute from "./routes/push";
import ackRoute from "./routes/ack";
import reportRoute from "./routes/report";
import historyRoute from "./routes/history";
import webRoute from "./routes/web";
import docsRoute from "./routes/docs";
import authRoute from "./routes/auth";
import openclawWebhookRoute from "./routes/openclaw-webhook";
import reportsActiveRoute from "./routes/reports-active";
import warningPersonalRoute from "./routes/warning-personal";
import fishermenRoute from "./routes/fishermen";
import trustIndexRoute from "./routes/trust-index";
import incidentsRoute from "./routes/incidents";
import researchRoute from "./routes/research";
import { startNowcastMonitor } from "./lib/bmkg-nowcast";
import { startMorningSchedule } from "./routes/broadcast-morning";
import { sendOpenClawToGroups } from "./lib/openclaw";
import { publishIotAlertForEvent } from "./lib/iot-mqtt";
import bmkgRoute from "./routes/bmkg";
import alertsRoute from "./routes/alerts";
import reportSubmitRoute from "./routes/report-submit";
import broadcastMorningRoute from "./routes/broadcast-morning";

const app = new Hono();
app.use(
	"/api/*",
	cors({ origin: CORS_ALLOWED_ORIGINS.includes("*") ? "*" : CORS_ALLOWED_ORIGINS }),
);
app.onError((err, c) => {
	console.error("[unhandled-error]", {
		path: c.req.path,
		method: c.req.method,
		error: err instanceof Error ? err.message : String(err),
	});

	if (err instanceof HTTPException) {
		return err.getResponse();
	}

	if (c.req.path.startsWith("/api/")) {
		return c.json({ ok: false, error: "internal server error" }, 500);
	}

	return c.text("Internal Server Error", 500);
});

await initRedis();
initDb();
initWebPush();
startMorningSchedule();
startNowcastMonitor({ sendWhatsApp: (group, text) => sendOpenClawToGroups([group], text), publishIot: publishIotAlertForEvent });

await sub.subscribe(ALERTS_CHANNEL, async (message) => {
	console.log("[sub] received alert from Redis, SSE clients:", sseClients.size, "WS clients:", wsClients.size);
	if (ENABLE_SSE_DELIVERY) {
		for (const client of sseClients) {
			try {
				await client.writeSSE({ event: "alert", data: message });
			} catch {
				sseClients.delete(client);
			}
		}
	}

	if (ENABLE_WS_DELIVERY) {
		for (const client of wsClients) {
			if (client.readyState !== WebSocket.OPEN) {
				wsClients.delete(client);
				continue;
			}
			try {
				client.send(message);
			} catch {
				wsClients.delete(client);
			}
		}
	}

	if (ENABLE_PUSH_DELIVERY) {
		console.log("[push] attempting push delivery");
		const pushResult = await sendPushAlertToAll(message);
		console.log("[push] result:", pushResult);
	}
});

app.route("/api", healthRoute);
app.route("/api", sseRoute);
app.route("/api", wsRoute);
app.route("/api", pushRoute);
app.route("/api", ackRoute);
app.route("/api", reportRoute);
app.route("/api", historyRoute);
app.route("/api", docsRoute);
app.route("/api", authRoute);
app.route("/api", openclawWebhookRoute);
app.route("/api", reportsActiveRoute);
app.route("/api", warningPersonalRoute);
app.route("/api", fishermenRoute);
app.route("/api", incidentsRoute);
app.route("/api", trustIndexRoute);
app.route("/api", researchRoute);
app.route("/api", bmkgRoute);
app.route("/api", alertsRoute);
app.route("/api", reportSubmitRoute);
app.route("/api", broadcastMorningRoute);
app.route("/", webRoute);

export default {
	port: PORT,
	idleTimeout: 0,
	fetch: app.fetch,
	websocket,
};
