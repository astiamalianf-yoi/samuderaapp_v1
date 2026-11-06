import { BEACHES, LIK_SIGNS } from "./constants";
import type { AlertFeedItem, ExplanationData } from "./types";

type RawAlertEvent = {
	alertId?: string;
	serverTimestamp?: number;
	reporterCount?: number;
	riskLevel?: string;
	firstReportAt?: number;
	lastReportAt?: number;
	decision?: {
		community_characteristics?: string;
		is_actionable?: boolean;
		is_multisign?: boolean;
		final_risk_level?: string;
	};
	input?: {
		beach_location?: string;
		lik_codes?: string[];
	};
	ml?: {
		sign_description?: string;
		action_recommendation?: string;
		community_characteristics?: string;
		triggered_lik_codes?: string[];
		explanation?: {
			summary_id?: string;
			summary_en?: string;
			contributions?: Array<{
				factor: string;
				label_id: string;
				label_en: string;
				category: string;
				weight: number;
				direction: string;
				detail_id: string;
				detail_en: string;
			}>;
			community_profile?: {
				beach: string;
				overall: string;
				factors: Array<{
					key: string;
					label_id: string;
					label_en: string;
					value: number;
					status: string;
					detail_id: string;
					detail_en: string;
				}>;
			};
		};
	};
	reassurance?: {
		shapRisk?: string;
		bmkgRisk?: string;
		agreed?: boolean;
		finalLevel?: string;
	};
	beachLocation?: string;
	triggeredCodes?: string[];
	signDescription?: string;
	actionRecommendation?: string;
	communityCharacteristics?: string;
};

function deriveRiskLevel(raw: RawAlertEvent): string {
	if (raw.decision?.final_risk_level) return raw.decision.final_risk_level.toLowerCase();
	if (raw.reassurance?.finalLevel) return raw.reassurance.finalLevel.toLowerCase();
	if (raw.riskLevel) return raw.riskLevel;
	const cc = raw.decision?.community_characteristics ?? raw.ml?.community_characteristics ?? "";
	if (cc === "Actionable") {
		return raw.decision?.is_multisign ? "siaga" : "waspada";
	}
	return "normal";
}

export function transformAlert(raw: RawAlertEvent): AlertFeedItem {
	return {
		alertId: raw.alertId ?? "",
		beachLocation: raw.beachLocation ?? raw.input?.beach_location ?? "",
		riskLevel: deriveRiskLevel(raw),
		reporterCount: raw.reporterCount ?? 0,
		firstReportAt: raw.firstReportAt ?? raw.serverTimestamp ?? 0,
		lastReportAt: raw.lastReportAt ?? raw.serverTimestamp ?? 0,
		signDescription: raw.signDescription ?? raw.ml?.sign_description ?? "",
		actionRecommendation: raw.actionRecommendation ?? raw.ml?.action_recommendation ?? "",
		triggeredCodes: raw.triggeredCodes ?? raw.ml?.triggered_lik_codes ?? raw.input?.lik_codes ?? [],
		serverTimestamp: raw.serverTimestamp ?? 0,
		communityCharacteristics: raw.communityCharacteristics ?? raw.decision?.community_characteristics,
		explanation: raw.ml?.explanation as ExplanationData | undefined,
		reassurance: raw.reassurance ? {
			shapRisk: raw.reassurance.shapRisk ?? "",
			bmkgRisk: raw.reassurance.bmkgRisk ?? "",
			agreed: raw.reassurance.agreed ?? false,
			finalLevel: raw.reassurance.finalLevel ?? "",
		} : undefined,
	};
}

export function isUnsafe(risk: string): boolean {
	const lower = risk.toLowerCase();
	return lower.includes("unsafe") || lower.includes("tidak aman") || lower.includes("high") || lower.includes("actionable") || lower === "waspada" || lower === "siaga" || lower === "ekstrem";
}

export function beachName(slug: string): string {
	const b = BEACHES.find((x) => x.id === slug);
	return b?.name ?? slug.replace(/_/g, " ");
}

export function codeToLabel(code: string): string {
	const sign = LIK_SIGNS.find((s) => s.code === code);
	return sign?.label ?? code;
}

export function deriveAlertTitle(alert: AlertFeedItem): string {
	const name = beachName(alert.beachLocation);
	const level = alert.riskLevel.toLowerCase();
	if (level === "ekstrem" || level === "unsafe-high") return `BAHAYA EKSTREM di ${name}`;
	if (level === "siaga") return `Siaga di ${name}`;
	if (level === "waspada" || level === "unsafe") return `Waspada di ${name}`;
	return `Kondisi Aman di ${name}`;
}

export function deriveStartDate(alert: AlertFeedItem): string {
	return new Date(alert.firstReportAt).toISOString();
}

export function deriveEndDate(alert: AlertFeedItem): string {
	return new Date(alert.lastReportAt).toISOString();
}
