"use client";

import type { AlertFeedItem } from "@/lib/types";
import { ShieldCheck, TriangleAlert, AlertTriangle, Eye, Loader2 } from "lucide-react";
import { deriveAlertTitle } from "@/lib/alert-utils";

type AlertBannerProps = {
	alerts: AlertFeedItem[];
	loading?: boolean;
};

function getHighestRisk(alerts: AlertFeedItem[]): "normal" | "waspada" | "siaga" | "ekstrem" {
	const order = ["ekstrem", "siaga", "waspada", "normal"];
	for (const level of order) {
		if (alerts.some((a) => a.riskLevel.toLowerCase() === level || (level === "ekstrem" && a.riskLevel.toLowerCase() === "unsafe-high") || (level === "waspada" && a.riskLevel.toLowerCase() === "unsafe"))) {
			return level as "normal" | "waspada" | "siaga" | "ekstrem";
		}
	}
	return "normal";
}

const RISK_CONFIG: Record<string, { bg: string; icon: typeof ShieldCheck; label: string; subtitle: string }> = {
	normal: { bg: "#16A34A", icon: ShieldCheck, label: "AMAN UNTUK MELAUT", subtitle: "BMKG: Aman. Tanda Alam: Aman." },
	waspada: { bg: "#F59E0B", icon: Eye, label: "WASPADA", subtitle: "Kondisi cuaca perlu diwaspadai." },
	siaga: { bg: "#EA580C", icon: AlertTriangle, label: "SIAGA", subtitle: "Kondisi cuaca berbahaya. Pertimbangkan untuk tidak melaut." },
	ekstrem: { bg: "#DC2626", icon: TriangleAlert, label: "BAHAYA! JANGAN MELAUT", subtitle: "Kondisi cuaca sangat berbahaya!" },
};

export function AlertBanner({ alerts, loading }: AlertBannerProps) {
	if (loading && alerts.length === 0) {
		return (
			<div
				className="w-full rounded-2xl p-5 flex flex-col items-center gap-2 text-center"
				style={{ backgroundColor: "#0EA5E9" }}
			>
				<Loader2 className="text-white animate-spin" size={40} />
				<span className="text-white text-lg">Memuat data...</span>
			</div>
		);
	}

	if (alerts.length === 0) {
		const config = RISK_CONFIG.normal;
		const Icon = config.icon;
		return (
			<div className="w-full rounded-2xl p-5 flex flex-col items-center gap-2 text-center" style={{ backgroundColor: config.bg }}>
				<Icon className="text-white" size={40} />
				<span className="text-white text-2xl font-bold">{config.label}</span>
				<span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>{config.subtitle}</span>
			</div>
		);
	}

	const level = getHighestRisk(alerts);
	const config = RISK_CONFIG[level];
	const Icon = config.icon;
	const subtitle = level === "normal" ? config.subtitle : deriveAlertTitle(alerts[0]);

	return (
		<div
			className={`w-full rounded-2xl p-5 flex flex-col items-center gap-2 text-center ${level === "ekstrem" ? "animate-pulse" : ""}`}
			style={{ backgroundColor: config.bg }}
		>
			<Icon className="text-white" size={40} />
			<span className="text-white text-2xl font-bold">{config.label}</span>
			<span className="text-sm" style={{ color: "rgba(255, 255, 255, 0.7)" }}>{subtitle}</span>
		</div>
	);
}
