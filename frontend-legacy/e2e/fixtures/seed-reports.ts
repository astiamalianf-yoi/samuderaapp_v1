const API_BASE = "http://localhost:3000/api";

export type SeedResult = {
	alertOk: boolean;
	reportId: string;
	alertEvent: Record<string, unknown> | null;
};

export async function submitReport(
	beachLocation: string,
	likCodes: string[],
): Promise<{ ok: boolean; reportId?: string; status?: string; alertEvent?: Record<string, unknown> }> {
	const res = await fetch(`${API_BASE}/report`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			beach_location: beachLocation,
			lik_codes: likCodes,
			channel: "e2e-test",
			clientReportId: crypto.randomUUID(),
			createdAtClient: Date.now(),
		}),
	});
	return res.json();
}

export async function seedReportsUntilAlert(
	beachLocation: string,
	likCodes: string[],
	maxReports = 5,
): Promise<SeedResult> {
	for (let i = 0; i < maxReports; i++) {
		const result = await submitReport(beachLocation, likCodes);
		console.log(`[seed] Report ${i + 1}/${maxReports}: ok=${result.ok} status=${result.status} hasAlert=${!!result.alertEvent}`);
		if (!result.ok) {
			throw new Error(`Report ${i + 1}/${maxReports} failed: ${JSON.stringify(result)}`);
		}
		if (result.alertEvent) {
			return { alertOk: true, reportId: result.reportId ?? "", alertEvent: result.alertEvent };
		}
	}

	return { alertOk: false, reportId: "", alertEvent: null };
}

export async function resetBeachQueues(_beachLocation: string): Promise<void> {
	const res = await fetch(`${API_BASE}/test/reset`, { method: "POST" });
	if (!res.ok) {
		const text = await res.text().catch(() => "unknown error");
		throw new Error(`Failed to reset queues: ${res.status} ${text}`);
	}
	console.log(`[seed] Reset queues (Redis FLUSHALL)`);
}

export async function fetchAlertsFromApi(limit = 20): Promise<Record<string, unknown>[]> {
	const res = await fetch(`${API_BASE}/alerts?limit=${limit}`);
	const json = await res.json();
	if (!json.ok) return [];
	return json.data;
}
