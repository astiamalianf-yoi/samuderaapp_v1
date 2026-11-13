"use client";

import { CheckCircle, AlertTriangle } from "lucide-react";

type CrossValidationBadgeProps = {
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

export function CrossValidationBadge({ shapRisk, bmkgRisk, agreed, finalLevel, bmkgDetails }: CrossValidationBadgeProps) {
	return (
		<div>
			<h4 className="text-xs font-semibold text-[#0A2540] mb-2">Validasi Silang (SHAP + BMKG)</h4>
			<div className={`rounded-lg border p-3 ${agreed ? "border-green-200 bg-green-50/50" : "border-yellow-200 bg-yellow-50/50"}`}>
				<div className="flex items-center gap-2 mb-2">
					{agreed ? (
						<CheckCircle size={16} className="text-green-600 flex-shrink-0" />
					) : (
						<AlertTriangle size={16} className="text-yellow-600 flex-shrink-0" />
					)}
					<span className="text-xs font-medium">
						{agreed ? "Konsisten" : "Tidak Konsisten"}
					</span>
				</div>
				<div className="grid grid-cols-3 gap-2 text-center">
					<div>
						<p className="text-[10px] text-muted-foreground">SHAP</p>
						<p className={`text-xs font-bold ${shapRisk === "HIGH" || shapRisk === "UNSAFE" || shapRisk === "ACTIONABLE" ? "text-red-600" : "text-green-600"}`}>
							{shapRisk}
						</p>
					</div>
					<div>
						<p className="text-[10px] text-muted-foreground">BMKG</p>
						<p className={`text-xs font-bold ${bmkgRisk === "HIGH" ? "text-red-600" : bmkgRisk === "MEDIUM" ? "text-yellow-600" : "text-green-600"}`}>
							{bmkgRisk}
						</p>
					</div>
					<div>
						<p className="text-[10px] text-muted-foreground">Fusi</p>
						<p className="text-xs font-bold text-[#0A2540]">{finalLevel}</p>
					</div>
				</div>
				{bmkgDetails && (
					<div className="mt-2 pt-2 border-t border-yellow-200/50 flex gap-3 text-[10px] text-muted-foreground">
						<span>Gelombang: {bmkgDetails.waveHeight}m</span>
						<span>Angin: {bmkgDetails.windSpeed}km/j</span>
						{bmkgDetails.hasWarning && <span className="text-yellow-700 font-medium">Peringatan Aktif</span>}
					</div>
				)}
			</div>
		</div>
	);
}
