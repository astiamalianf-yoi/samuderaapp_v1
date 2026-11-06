"use client";

import { Cloud, Waves, Wind, Thermometer, ShieldCheck, ShieldAlert } from "lucide-react";
import type { BmkgData } from "@/lib/types";
import { BEACHES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type WeatherFooterProps = {
	bmkgData: (BmkgData | null)[];
};

function getBeachData(beachId: string, data: (BmkgData | null)[]): BmkgData | null {
	return data.find((d) => d?.beach === beachId) ?? null;
}

export function WeatherFooter({ bmkgData }: WeatherFooterProps) {
	return (
		<section>
			<div className="flex items-center gap-2">
				<Cloud size={20} className="text-[#475569]" />
				<span className="text-sm font-semibold text-[#475569]">Sumber Data: BMKG</span>
			</div>
			<p className="text-xs text-[#94A3B8]">
				Data cuaca dari BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)
			</p>
			<div className="flex flex-col gap-3 mt-3">
				{BEACHES.map((beach) => {
					const data = getBeachData(beach.id, bmkgData);
					return (
						<div key={beach.id} className="bg-white rounded-xl shadow-sm p-3">
							<p className="text-base font-semibold text-[#0A2540]">{beach.name}</p>
							{data ? (
								<>
									<div className="flex items-center gap-1.5 mt-1">
										<Cloud size={16} className="text-[#475569]" />
										<span className="text-sm text-[#475569]">{data.weather}</span>
									</div>
									<div className="flex gap-4 mt-1">
										<div className="flex items-center gap-1">
											<Waves size={16} className="text-[#475569]" />
											<span className="text-sm text-[#475569]">{data.waveHeight}m</span>
										</div>
										<div className="flex items-center gap-1">
											<Wind size={16} className="text-[#475569]" />
											<span className="text-sm text-[#475569]">
												{data.windSpeed} km/h {data.windDirection}
											</span>
										</div>
										<div className="flex items-center gap-1">
											<Thermometer size={16} className="text-[#475569]" />
											<span className="text-sm text-[#475569]">{data.temperature}°C</span>
										</div>
									</div>
									<div className="mt-2">
										{data.isSafe ? (
											<span
												className={cn(
													"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
													"bg-[#16A34A]/10 text-[#16A34A]"
												)}
											>
												<ShieldCheck size={14} />
												Aman
											</span>
										) : (
											<span
												className={cn(
													"inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
													"bg-[#DC2626]/10 text-[#DC2626]"
												)}
											>
												<ShieldAlert size={14} />
												Tidak Aman
											</span>
										)}
									</div>
								</>
							) : (
								<p className="text-sm text-[#94A3B8] italic mt-1">
									Data tidak tersedia
								</p>
							)}
						</div>
					);
				})}
			</div>
		</section>
	);
}
