"use client";

import type { CommunityProfileFactor } from "@/lib/types";

type CommunityProfileTableProps = {
	beach: string;
	overall: string;
	factors: CommunityProfileFactor[];
};

function StatusBadge({ status }: { status: string }) {
	const isUnsafe = status === "Unsafe";
	return (
		<span
			className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
				isUnsafe
					? "bg-red-50 text-red-700 border border-red-200"
					: "bg-green-50 text-green-700 border border-green-200"
			}`}
		>
			{isUnsafe ? "Rentan" : "Aman"}
		</span>
	);
}

export function CommunityProfileTable({ beach, overall, factors }: CommunityProfileTableProps) {
	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<h4 className="text-xs font-semibold text-[#0A2540]">Profil Komunitas</h4>
				<span
					className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
						overall === "Unsafe"
							? "bg-red-50 text-red-700 border border-red-200"
							: "bg-green-50 text-green-700 border border-green-200"
					}`}
				>
					{overall === "Unsafe" ? "Rentan" : "Aman"}
				</span>
			</div>
			<div className="rounded-lg border overflow-hidden">
				<table className="w-full text-xs">
					<thead>
						<tr className="bg-muted/50">
							<th className="text-left px-3 py-1.5 font-medium text-muted-foreground">Faktor</th>
							<th className="text-center px-3 py-1.5 font-medium text-muted-foreground">Nilai</th>
							<th className="text-center px-3 py-1.5 font-medium text-muted-foreground">Status</th>
						</tr>
					</thead>
					<tbody>
						{factors.map((f) => (
							<tr key={f.key} className="border-t">
								<td className="px-3 py-1.5">
									<span className="font-medium">{f.label_id}</span>
									<p className="text-[10px] text-muted-foreground">{f.detail_id}</p>
								</td>
								<td className="text-center px-3 py-1.5 font-mono">{f.value.toFixed(2)}</td>
								<td className="text-center px-3 py-1.5">
									<StatusBadge status={f.status} />
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
