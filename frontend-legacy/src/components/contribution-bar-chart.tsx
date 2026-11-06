"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { ContributionItem } from "@/lib/types";

type ContributionBarChartProps = {
	contributions: ContributionItem[];
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ContributionItem }> }) {
	if (!active || !payload?.length) return null;
	const item = payload[0].payload;
	return (
		<div className="rounded-lg border bg-white px-3 py-2 shadow-sm text-xs">
			<p className="font-semibold">{item.label_id}</p>
			<p className="text-muted-foreground">{item.detail_id}</p>
			<p className="font-medium mt-1">{Math.round(item.weight * 100)}%</p>
		</div>
	);
}

const SIGN_COLORS = ["#DC2626", "#EA580C", "#F59E0B"];
const COMMUNITY_COLORS = ["#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD", "#DDD6FE"];

export function ContributionBarChart({ contributions }: ContributionBarChartProps) {
	const visible = contributions.filter((c) => c.weight > 0);

	if (visible.length === 0) return null;

	const data = visible.map((c) => ({
		...c,
		displayName: c.label_id,
		percentage: Math.round(c.weight * 100),
	}));

	return (
		<div>
			<h4 className="text-xs font-semibold text-[#0A2540] mb-2">Kontribusi Faktor Risiko</h4>
			<ResponsiveContainer width="100%" height={Math.max(data.length * 36, 120)}>
				<BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
					<XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} hide />
					<YAxis type="category" dataKey="displayName" width={130} tick={{ fontSize: 11 }} />
					<Tooltip content={<CustomTooltip />} />
					<Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={24}>
						{data.map((entry, index) => {
							const isNatural = entry.category === "natural_sign";
							const palette = isNatural ? SIGN_COLORS : COMMUNITY_COLORS;
							const colorIndex = isNatural
								? data.filter((d) => d.category === "natural_sign").indexOf(entry)
								: data.filter((d) => d.category === "community").indexOf(entry);
							return <Cell key={entry.factor} fill={palette[colorIndex % palette.length]} />;
						})}
					</Bar>
				</BarChart>
			</ResponsiveContainer>
			<div className="flex gap-4 mt-2 text-[10px] text-muted-foreground">
				<span className="flex items-center gap-1">
					<span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#DC2626]" />
					Tanda Alam
				</span>
				<span className="flex items-center gap-1">
					<span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#7C3AED]" />
					Faktor Komunitas
				</span>
			</div>
		</div>
	);
}
