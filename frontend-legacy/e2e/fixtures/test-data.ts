export const API_BASE = "http://localhost:3000/api";

export const BEACH_NAMES = ["Lampuuk", "Lhoknga", "Ulee Lheue", "Depok", "Samas"] as const;

export const LIK_SIGN_LABELS = [
	"Awan turun",
	"Awan bergumpal",
	"Kilat",
	"Ombak besar",
] as const;

export async function seedAlert(
	beachLocation: string,
	likCodes: string[],
): Promise<Record<string, unknown>> {
	const res = await fetch(`${API_BASE}/report`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			beach_location: beachLocation,
			lik_codes: likCodes,
			channel: "test",
			clientReportId: crypto.randomUUID(),
			createdAtClient: Date.now(),
		}),
	});
	return res.json();
}
