"use client";

import type { ExplanationData } from "@/lib/types";
import { ContributionBarChart } from "./contribution-bar-chart";
import { CommunityProfileTable } from "./community-profile-table";
import { CrossValidationBadge } from "./cross-validation-badge";
import { ExplanationInfo } from "./explanation-info";

type ExplanationPanelProps = {
	explanation: ExplanationData;
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
	} | null;
};

export function ExplanationPanel({ explanation, reassurance }: ExplanationPanelProps) {
	return (
		<div className="space-y-4 pt-2">
			{explanation.summary_id && (
				<p className="text-xs text-muted-foreground leading-relaxed">{explanation.summary_id}</p>
			)}

			<ContributionBarChart contributions={explanation.contributions} />

			{explanation.community_profile && (
				<>
					<CommunityProfileTable
						beach={explanation.community_profile.beach}
						overall={explanation.community_profile.overall}
						factors={explanation.community_profile.factors}
					/>
					<ExplanationInfo />
				</>
			)}

			{reassurance && (
				<CrossValidationBadge
					shapRisk={reassurance.shapRisk}
					bmkgRisk={reassurance.bmkgRisk}
					agreed={reassurance.agreed}
					finalLevel={reassurance.finalLevel}
					bmkgDetails={reassurance.bmkgDetails}
				/>
			)}
		</div>
	);
}
