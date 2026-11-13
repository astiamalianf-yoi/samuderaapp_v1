type BmkgBeachItemProps = {
	label: string;
	waveHeight: number;
	temperature: number;
	fullWidth?: boolean;
};

export function BmkgBeachItem({ label, waveHeight, temperature, fullWidth }: BmkgBeachItemProps) {
	return (
		<div
			className={
				"rounded-lg bg-[#F0F9FF] px-2 py-1 text-xs text-slate-700 text-center font-bold" +
				(fullWidth ? " col-span-2" : "")
			}
		>
			{label} {temperature}°
		</div>
	);
}
