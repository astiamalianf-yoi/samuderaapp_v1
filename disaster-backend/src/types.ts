export const ALLOWED_BEACH_LOCATIONS = [
	"pantai_lampuuk",
	"pantai_lhoknga",
	"pantai_ulee_lheue",
	"pantai_depok",
	"pantai_samas",
	"pantai_pangandaran",
	"pantai_batu_karas",
	"pantai_bojongsalawe",
] as const;

export type BeachLocation = (typeof ALLOWED_BEACH_LOCATIONS)[number];

export type PredictionInput = {
	lik_codes: string[];
	beach_location: BeachLocation;
	clientReportId?: string;
	createdAtClient?: number;
	/** Anonymous id kept on the phone, so repeated reports from one phone are recognised. */
	deviceId?: string;
	_experimentId?: string;
	is_active_warning?: boolean;
	active_warning?: string[];
	_channel?: string;
};

export type ContributionItem = {
	factor: string;
	label_id: string;
	label_en: string;
	category: "natural_sign" | "community";
	weight: number;
	direction: "increases_risk" | "neutral";
	detail_id: string;
	detail_en: string;
};

export type CommunityProfileFactor = {
	key: string;
	label_id: string;
	label_en: string;
	value: number;
	status: string;
	detail_id: string;
	detail_en: string;
};

export type ExplanationData = {
	summary_id: string;
	summary_en: string;
	contributions: ContributionItem[];
	community_profile: {
		beach: string;
		overall: string;
		factors: CommunityProfileFactor[];
	};
};

export type MlResult = {
	active_warning: string[];
	sign_description: string;
	community_characteristics: string;
	action_recommendation: string;
	triggered_lik_codes?: string[];
	explanation?: ExplanationData;
	/** LIK hazard level from the warning strategy (paper Eq. 5): NORMAL | WASPADA | SIAGA. */
	lik_risk_level?: "NORMAL" | "WASPADA" | "SIAGA";
	warning_strategy?: WarningStrategy | null;
	signs?: Array<{
		code: string;
		trust_tier: "High" | "Low";
		ranked: boolean;
		behavioral_class: 0 | 1;
		probability_actionable: number | null;
		strategy: WarningStrategyCode;
		dominant_action: string | null;
	}>;
};

export type WarningStrategyCode = "STANDARD" | "EXTRA_WARNING" | "ENHANCED_MONITORING" | "MAXIMUM_ALERT";

export type WarningStrategy = {
	code: WarningStrategyCode;
	label_id: string;
	label_en: string;
	message_id: string;
	trust_tier: "High" | "Low";
	behavioral_class: 0 | 1;
	behavioral_label: "Actionable" | "Inaction";
	behavioral_source: "random_forest" | "beach_profile";
};

/**
 * LIK level used in the SHAP+BMKG fusion. Prefers the strategy-based level from the
 * model service; falls back to the legacy community_characteristics mapping for older
 * model-service responses.
 */
export function likRiskLevel(result: MlResult, isMultisign: boolean): string {
	if (result.lik_risk_level) return result.lik_risk_level;
	if (result.community_characteristics === "Actionable") return isMultisign ? "SIAGA" : "WASPADA";
	return "NORMAL";
}

export type AckInput = {
	alertId: string;
	transport: "SSE" | "WS" | "PUSH";
	receivedAtClient: number;
	serverTimestamp: number;
	ackStage?: "DELIVERED" | "OPENED";
	// Optional fields you can add later:
	clientId?: string;
	// userId?: string;
};
