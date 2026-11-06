"use client";

import { useEffect, useState } from "react";
import { AlertBanner } from "@/components/alert-banner";
import { SummaryCards } from "@/components/summary-cards";
import { ReportCTA } from "@/components/report-cta";
import { AlertFeed } from "@/components/alert-feed";
import { WeatherFooter } from "@/components/weather-footer";
import { NotificationCard } from "@/components/notification-card";
import { InstallPrompt } from "@/components/install-prompt";
import { fetchAllBmkgData } from "@/lib/api";
import type { AlertFeedItem, BmkgData } from "@/lib/types";
import { connectSSE } from "@/lib/sse";
import { fetchAlerts } from "@/lib/api";

export default function Home() {
	const [alerts, setAlerts] = useState<AlertFeedItem[]>([]);
	const [bmkgData, setBmkgData] = useState<BmkgData[]>([]);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
		fetchAlerts(20).then(setAlerts);
		fetchAllBmkgData().then(setBmkgData);
	}, []);

	useEffect(() => {
		const disconnect = connectSSE((newAlert) => {
			setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
		});
		return disconnect;
	}, []);

	return (
		<main className="flex flex-col gap-6 px-4 py-4 max-w-2xl mx-auto pb-24">
			<AlertBanner alerts={alerts} />
			<SummaryCards bmkgData={mounted ? bmkgData : []} alertCount={alerts.length} />
			<NotificationCard />
			<InstallPrompt />
			<ReportCTA />
			<AlertFeed alerts={alerts} />
			<WeatherFooter bmkgData={bmkgData} />
		</main>
	);
}
