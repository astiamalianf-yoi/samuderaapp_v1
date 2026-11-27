"use client";

import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { BEACHES } from "@/lib/constants";
import { BEACH_COORDS } from "@/lib/beach-coords";
import { fetchAllBmkgData, fetchAlerts } from "@/lib/api";
import type { BmkgData, AlertFeedItem } from "@/lib/types";

function createIcon(safe: boolean) {
	return L.divIcon({
		html: `<div style="width:36px;height:36px;border-radius:50%;background:${safe ? "#0EA5E9" : "#DC2626"};display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:bold;">${safe ? "&#10003;" : "&#10007;"}</div>`,
		iconSize: [36, 36],
		iconAnchor: [18, 18],
		className: "",
	});
}

function createUserIcon() {
	return L.divIcon({
		html: `<div style="width:20px;height:20px;border-radius:50%;background:#7C3AED;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
		iconSize: [20, 20],
		iconAnchor: [10, 10],
		className: "",
	});
}

function LocationControl({ onLocate }: { onLocate: () => void }) {
	return (
		<button
			onClick={onLocate}
			title="Lokasi Saya"
			className="leaflet-control-locate"
			style={{
				width: 40,
				height: 40,
				background: "#fff",
				border: "2px solid rgba(0,0,0,0.1)",
				borderRadius: 8,
				cursor: "pointer",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: 20,
			}}
		>
			&#9768;
		</button>
	);
}

function isBeachUnsafe(
	beachId: string,
	alerts: AlertFeedItem[],
	bmkgData: BmkgData[],
): boolean {
	const hasUnsafeAlert = alerts.some(
		(a) =>
			a.beachLocation === beachId &&
			/unsafe|tidak aman|high/i.test(a.riskLevel),
	);
	const hasUnsafeBmkg = bmkgData.some(
		(b) => b.beach === beachId && !b.isSafe,
	);
	return hasUnsafeAlert || hasUnsafeBmkg;
}

export default function PetaMap() {
	const [bmkgData, setBmkgData] = useState<BmkgData[]>([]);
	const [alerts, setAlerts] = useState<AlertFeedItem[]>([]);
	const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
	const [locating, setLocating] = useState(false);
	const mapRef = useRef<L.Map | null>(null);

	useEffect(() => {
		fetchAllBmkgData().then(setBmkgData);
		fetchAlerts(20).then(setAlerts);
	}, []);

	const handleLocate = () => {
		if (!navigator.geolocation) return;
		setLocating(true);
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				setUserPosition([pos.coords.latitude, pos.coords.longitude]);
				mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 1 });
				setLocating(false);
			},
			() => setLocating(false),
			{ enableHighAccuracy: true, timeout: 10000 },
		);
	};

	return (
		<div className="relative h-full w-full">
			<LocationControl onLocate={handleLocate} />
			<MapContainer
				center={[-8.0225, 110.33]}
				zoom={11}
				ref={mapRef}
				style={{ height: "100%", width: "100%" }}
			>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
				url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
			/>
			{BEACHES.map((beach) => {
				const coords = BEACH_COORDS[beach.id];
				if (!coords) return null;
				const unsafe = isBeachUnsafe(beach.id, alerts, bmkgData);
				const beachWeather = bmkgData.find((b) => b.beach === beach.id);
				return (
					<Marker
						key={beach.id}
						position={[coords.lat, coords.lng]}
						icon={createIcon(!unsafe)}
					>
						<Popup>
							<div className="text-sm space-y-2 min-w-[180px]">
								<h3 className="font-bold text-base text-[#0A2540]">
									{beach.name}
								</h3>
								{beachWeather && (
									<div className="space-y-1 text-xs text-gray-600">
										<p>Cuaca: {beachWeather.weather}</p>
										<p>Tinggi ombak: {beachWeather.waveHeight} m</p>
										<p>Angin: {beachWeather.windSpeed} km/h {beachWeather.windDirection}</p>
										<p>Suhu: {beachWeather.temperature}°C</p>
									</div>
								)}
								<span
									className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white ${
										unsafe ? "bg-[#DC2626]" : "bg-[#0EA5E9]"
									}`}
								>
									{unsafe ? "Bahaya" : "Aman"}
								</span>
							</div>
						</Popup>
					</Marker>
				);
			})}
			{userPosition && (
				<Marker
					position={userPosition}
					icon={L.divIcon({
						html: `<div style="width:20px;height:20px;border-radius:50%;background:#0EA5E9;border:3px solid #fff;box-shadow:0 0 8px rgba(14,165,233,0.6);"></div>`,
						iconSize: [20, 20],
						iconAnchor: [10, 10],
						className: "",
					})}
				>
					<Popup>
						<div className="text-sm font-semibold text-[#0A2540]">Lokasi Saya</div>
					</Popup>
				</Marker>
			)}
		</MapContainer>
		</div>
	);
}
