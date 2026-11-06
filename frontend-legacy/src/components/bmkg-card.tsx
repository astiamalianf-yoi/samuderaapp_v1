"use client";

import { CloudSun } from "lucide-react";
import type { BmkgData } from "@/lib/types";
import { BEACHES } from "@/lib/constants";

type BmkgCardProps = {
	bmkgData: BmkgData[];
};

function BeachChip({
	label,
	waveHeight,
	temperature,
	fullWidth,
}: {
	label: string;
	waveHeight: number;
	temperature: number;
	fullWidth?: boolean;
}) {
	return (
		<div
			className={
				"rounded-lg bg-[#F0F9FF] px-2 py-1 text-xs text-slate-700" +
				(fullWidth ? " col-span-2" : "")
			}
		>
			{label} {waveHeight}m {temperature}°
		</div>
	);
}

export function BmkgCard({ bmkgData }: BmkgCardProps) {
	return (
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
							<BeachChip
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
	);
}
