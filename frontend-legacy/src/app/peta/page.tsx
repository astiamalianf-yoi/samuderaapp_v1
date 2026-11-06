"use client";

import dynamic from "next/dynamic";

const PetaMap = dynamic(() => import("./peta-map"), { ssr: false });

export default function PetaPage() {
	return (
		<main
			className="flex flex-col overflow-hidden"
			style={{
				height: "calc(100dvh - 64px)",
				paddingBottom: "env(safe-area-inset-bottom, 0px)",
			}}
		>
			<div className="px-4 py-3 shrink-0">
				<h1 className="text-xl font-bold font-[family-name:var(--font-heading)] text-[#0A2540]">
					Peta Pantai
				</h1>
			</div>
			<div className="flex-1 min-h-0">
				<PetaMap />
			</div>
		</main>
	);
}
