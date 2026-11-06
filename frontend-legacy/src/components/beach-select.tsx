"use client";

import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { BEACHES } from "@/lib/constants";

type BeachSelectProps = {
	selected: string | null;
	onSelect: (id: string) => void;
};

export function BeachSelect({ selected, onSelect }: BeachSelectProps) {
	return (
		<div className="grid grid-cols-2 gap-3">
			{BEACHES.map((beach) => (
				<button
					key={beach.id}
					type="button"
					onClick={() => onSelect(beach.id)}
					className={cn(
						"flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 min-h-[72px] transition-all",
						selected === beach.id
							? "border-[#0EA5E9] bg-[#0EA5E9] text-white scale-[1.02]"
							: "border-[#0A2540] bg-white text-[#0A2540] hover:border-[#0EA5E9]/50"
					)}
				>
					<MapPin className="h-7 w-7" />
					<span className="text-base font-semibold">{beach.label}</span>
				</button>
			))}
		</div>
	);
}
