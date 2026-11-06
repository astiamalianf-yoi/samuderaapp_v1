"use client";

import { useEffect, useState } from "react";
import { AlertCard } from "./alert-card";
import { fetchAlerts } from "@/lib/api";
import { connectSSE } from "@/lib/sse";
import type { AlertFeedItem } from "@/lib/types";
import { Waves } from "lucide-react";

type AlertFeedProps = {
	alerts?: AlertFeedItem[];
};

export function AlertFeed({ alerts: externalAlerts }: AlertFeedProps) {
	const [internalAlerts, setInternalAlerts] = useState<AlertFeedItem[]>([]);
	const [showAll, setShowAll] = useState(false);

	const alerts = externalAlerts ?? internalAlerts;

	useEffect(() => {
		if (externalAlerts) return;
		fetchAlerts(20).then(setInternalAlerts);
	}, [externalAlerts]);

	useEffect(() => {
		if (externalAlerts) return;
		const disconnect = connectSSE((newAlert) => {
			setInternalAlerts((prev) => [newAlert, ...prev].slice(0, 50));
		});
		return disconnect;
	}, [externalAlerts]);

	if (alerts.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
				<Waves className="h-12 w-12 mb-3 opacity-30" />
				<p className="text-sm">Belum ada peringatan saat ini</p>
			</div>
		);
	}

	const displayed = showAll ? alerts : alerts.slice(0, 5);

	return (
		<div>
			<h3 className="text-base font-semibold text-[#0A2540] mb-1">
				Peringatan Terbaru
			</h3>
			<div className="flex flex-col gap-3">
				{displayed.map((alert) => (
					<AlertCard key={alert.alertId} alert={alert} />
				))}
			</div>
			{alerts.length > 5 && (
				<button
					onClick={() => setShowAll((prev) => !prev)}
					className="text-sm text-[#0EA5E9] font-medium py-2"
				>
					{showAll ? "Tampilkan Sedikit" : "Lihat Semua"}
				</button>
			)}
		</div>
	);
}
