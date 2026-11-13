import {
	CloudLightning,
	Cloud,
	Zap,
	Waves,
	Fish,
	Bird,
	Wind,
	Sunset,
	Star,
	Moon,
} from "lucide-react";
import type { TrustedSign } from "@/lib/trusted-signs";

const ICON_MAP: Record<string, React.ElementType> = {
	"cloud-lightning": CloudLightning,
	cloud: Cloud,
	zap: Zap,
	waves: Waves,
	fish: Fish,
	bird: Bird,
	wind: Wind,
	sunset: Sunset,
	star: Star,
	moon: Moon,
};

type SignCardProps = {
	sign: TrustedSign;
};

export function SignCard({ sign }: SignCardProps) {
	const Icon = ICON_MAP[sign.icon] ?? Cloud;

	let actionColor = "text-[#F59E0B]";
	if (sign.action.includes("Tunggu di darat")) {
		actionColor = "text-[#DC2626]";
	} else if (sign.action.includes("Aman")) {
		actionColor = "text-[#16A34A]";
	} else if (sign.action.includes("hati-hati")) {
		actionColor = "text-[#F59E0B]";
	}

	return (
		<div className="bg-white rounded-2xl shadow-sm p-4">
			<div className="flex items-start gap-3">
				<Icon size={40} className="text-[#0EA5E9] shrink-0" />
				<div className="flex flex-col gap-1 min-w-0">
					<div className="flex items-center gap-2">
						<span className="text-lg font-semibold text-[#0A2540]">
							{sign.label}
						</span>
						<span className="inline rounded-full bg-[#E2E8F0] px-2 py-0.5 text-xs text-[#475569]">
							{sign.code}
						</span>
					</div>
					<span className={`text-sm font-semibold ${actionColor}`}>
						{sign.action}
					</span>
					<p className="text-sm text-[#475569] mt-1">{sign.description}</p>
				</div>
			</div>
		</div>
	);
}
