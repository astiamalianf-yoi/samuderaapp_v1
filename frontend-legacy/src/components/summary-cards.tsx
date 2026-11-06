"use client";

import { useState, useEffect, useCallback } from "react";
import { CloudSun, Eye, MapPin, Loader2 } from "lucide-react";
import { BmkgBeachItem } from "@/components/bmkg-beach-item";
import type { BmkgData } from "@/lib/types";
import { BEACHES } from "@/lib/constants";
import { BEACH_COORDS } from "@/lib/beach-coords";

type SummaryCardsProps = {
	bmkgData: BmkgData[];
	alertCount: number;
};

function findNearestBeach(lat: number, lng: number): string | null {
	let nearest: string | null = null;
	let minDist = Infinity;
	for (const [id, coord] of Object.entries(BEACH_COORDS)) {
		const d = Math.sqrt((lat - coord.lat) ** 2 + (lng - coord.lng) ** 2);
		if (d < minDist) {
			minDist = d;
			nearest = id;
		}
	}
	return nearest;
}

function UserLocationCard() {
	const [nearestBeach, setNearestBeach] = useState<string | null>(null);
	const [locating, setLocating] = useState(false);

	const locate = useCallback(() => {
		if (!navigator.geolocation) return;
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				const beach = findNearestBeach(pos.coords.latitude, pos.coords.longitude);
				setNearestBeach(beach);
				setLocating(false);
			},
			() => setLocating(false),
			{ enableHighAccuracy: true, timeout: 10000 },
		);
	}, []);

	if (!nearestBeach && !locating) {
		return (
			<button
				onClick={locate}
				className="rounded-2xl bg-white shadow-sm p-4 flex flex-col items-center justify-center gap-2 min-h-[72px] active:scale-[0.98] transition-transform"
			>
				<MapPin className="h-7 w-7 text-[#0EA5E9]" />
				<span className="text-sm font-semibold text-[#0A2540]">Lokasi Saya</span>
				<span className="text-xs text-slate-400">Tap untuk deteksi</span>
			</button>
		);
	}

	if (locating) {
		return (
			<div className="rounded-2xl bg-white shadow-sm p-4 flex flex-col items-center justify-center gap-2 min-h-[72px]">
				<Loader2 className="h-7 w-7 text-[#0EA5E9] animate-spin" />
				<span className="text-sm text-slate-400">Mencari lokasi...</span>
			</div>
		);
	}

	const beach = BEACHES.find((b) => b.id === nearestBeach);

	return (
		<div className="rounded-2xl bg-[#0EA5E9]/10 shadow-sm p-4 flex flex-col items-center justify-center gap-1 min-h-[72px]">
			<MapPin className="h-7 w-7 text-[#0EA5E9]" />
			<span className="text-sm font-bold text-[#0A2540]">{beach?.name ?? nearestBeach}</span>
			<span className="text-xs text-slate-500">Pantai terdekat</span>
		</div>
	);
}

export function SummaryCards({ bmkgData, alertCount }: SummaryCardsProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="grid grid-cols-2 gap-3">
				<div className="rounded-2xl bg-white shadow-sm p-4">
					<span className="text-xs uppercase tracking-wide text-slate-500">BMKG</span>
					<CloudSun className="mt-1 h-8 w-8 text-[#0EA5E9]" />
					<div className="mt-2 h-20 animate-pulse bg-slate-100 rounded-lg" />
				</div>
				<div className="rounded-2xl bg-white shadow-sm p-4">
					<span className="text-xs uppercase tracking-wide text-slate-500">LAPORAN WARGA</span>
					<Eye className="mt-1 h-8 w-8 text-[#0EA5E9]" />
					<div className="mt-2 h-20 animate-pulse bg-slate-100 rounded-lg" />
				</div>
				<div className="rounded-2xl bg-white shadow-sm p-4">
					<span className="text-xs uppercase tracking-wide text-slate-500">LOKASI SAYA</span>
					<MapPin className="mt-1 h-8 w-8 text-[#0EA5E9]" />
					<div className="mt-2 h-20 animate-pulse bg-slate-100 rounded-lg" />
				</div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-2 gap-3">
			<div className="rounded-2xl bg-white shadow-sm p-4">
				<span className="text-xs uppercase tracking-wide text-slate-500">
					BMKG
				</span>
				<CloudSun className="mt-1 h-8 w-8 text-[#0EA5E9]" />
				<div className="mt-2 grid grid-cols-2 gap-2">
					{bmkgData.length === 0 ? (
						<span className="col-span-2 text-sm text-slate-400">Belum ada data</span>
					) : (
						BEACHES.map((beach, i) => {
							const data = bmkgData.find((d) => d.beach === beach.id);
							if (!data) return null;
							return (
								<BmkgBeachItem
									key={beach.id}
									label={beach.label}
									waveHeight={data.waveHeight}
									temperature={data.temperature}
									fullWidth={i === BEACHES.length - 1}
								/>
							);
						})
					)}
				</div>
			</div>

			<UserLocationCard />

			<div className="col-span-2 rounded-2xl bg-white shadow-sm p-4">
				<span className="text-xs uppercase tracking-wide text-slate-500">
					LAPORAN WARGA
				</span>
				<Eye className="mt-1 h-8 w-8 text-[#0EA5E9]" />
				<p className="mt-2 text-[32px] font-bold text-[#0A2540]">
					{alertCount}
				</p>
				<p className="text-sm text-slate-500">Laporan hari ini</p>
			</div>
		</div>
	);
}
