export type BeachLocation = "pantai_lampuuk" | "pantai_lhoknga" | "pantai_ulee_lheue" | "pantai_depok" | "pantai_samas";

export type AlertFeedItem = {
	alertId: string;
	beachLocation: string;
	riskLevel: string;
	reporterCount: number;
	firstReportAt: number;
	lastReportAt: number;
	signDescription: string;
	actionRecommendation: string;
	triggeredCodes: string[];
	serverTimestamp: number;
	communityCharacteristics?: string;
	explanation?: ExplanationData;
	reassurance?: {
		shapRisk: string;
		bmkgRisk: string;
		agreed: boolean;
		finalLevel: string;
		bmkgDetails?: {
			waveHeight: number;
			windSpeed: number;
			hasWarning: boolean;
		} | null;
	};
};

export type BmkgData = {
	beach: string;
	weather: string;
	waveHeight: number;
	windSpeed: number;
	windDirection: string;
	temperature: number;
	isSafe: boolean;
	fetchedAt: number;
};

export interface IObservation {
  label: string;
  attribute: string;
  object: string;
  value: string;
}

export type ReportResult = {
	ok: boolean;
	reportId?: string;
	serverTimestamp?: number;
	status?: string;
	alertEvent?: Record<string, unknown>;
	reportCounts?: Record<string, number>;
	deduped?: boolean;
	error?: string;
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

export type AlertExplanationResponse = {
	alertId: string;
	riskLevel: string;
	beachLocation: string;
	summary_id: string;
	summary_en: string;
	contributions: ContributionItem[];
	communityProfile: ExplanationData["community_profile"] | null;
	reassurance: {
		shapRisk: string;
		bmkgRisk: string;
		agreed: boolean;
		finalLevel: string;
		bmkgDetails: {
			waveHeight: number;
			windSpeed: number;
			hasWarning: boolean;
		} | null;
	} | null;
	createdAt: string | null;
};
