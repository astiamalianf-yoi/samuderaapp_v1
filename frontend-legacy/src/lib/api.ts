import type { AlertFeedItem, BmkgData, ReportResult, AlertExplanationResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export async function submitReport(beachLocation: string, likCodes: string[]): Promise<ReportResult> {
	const res = await fetch(`${API_BASE}/report`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			beach_location: beachLocation,
			lik_codes: likCodes,
			channel: "web",
			clientReportId: crypto.randomUUID(),
			createdAtClient: Date.now(),
		}),
	});
	return res.json() as Promise<ReportResult>;
}

export async function fetchAlerts(limit = 20): Promise<AlertFeedItem[]> {
	const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
	const json = await res.json();
	if (!json.ok) return [];
	return json.data as AlertFeedItem[];
}

export async function fetchBmkgData(beach: string): Promise<BmkgData | null> {
	const res = await fetch(`${API_BASE}/bmkg/${beach}`);
	const json = await res.json();
	if (!json.ok) return null;
	return json.data as BmkgData;
}

export async function fetchAllBmkgData(): Promise<BmkgData[]> {
	const res = await fetch(`${API_BASE}/bmkg`);
	const json = await res.json();
	if (!json.ok) return [];
	return json.data as BmkgData[];
}

export async function getVapidPublicKey(): Promise<string> {
	const res = await fetch(`${API_BASE}/push/vapid-public-key`);
	const json = await res.json();
	return (json as { publicKey: string }).publicKey;
}

export async function subscribePush(subscription: PushSubscriptionJSON, beachLocation: string): Promise<void> {
	const res = await fetch(`${API_BASE}/push/subscribe`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			subscription,
			beach_location: beachLocation,
		}),
	});
	const json = await res.json();
	if (!json.ok) throw new Error(json.error ?? "Failed to subscribe");
}

export async function unsubscribePush(endpoint: string): Promise<void> {
	const res = await fetch(`${API_BASE}/push/unsubscribe`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ endpoint }),
	});
	const json = await res.json();
	if (!json.ok) throw new Error(json.error ?? "Failed to unsubscribe");
}

export async function fetchAlertExplanation(alertId: string): Promise<AlertExplanationResponse | null> {
	const res = await fetch(`${API_BASE}/alerts/${alertId}/explanation`);
	const json = await res.json();
	if (!json.ok) return null;
	return json.data as AlertExplanationResponse;
}
