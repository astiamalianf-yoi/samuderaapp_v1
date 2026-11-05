"use client";

import { useState } from "react";

export function WhatsAppFloatButton() {
	const [showTooltip, setShowTooltip] = useState<string | null>(null);

	const buttons = [
		{
			id: "personal",
			label: "Lapor via WhatsApp",
			href: "https://wa.me/6287816964069",
			bottom: "calc(72px + env(safe-area-inset-bottom))",
			bgColor: "#25D366",
			icon: (
				<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="white">
					<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
				</svg>
			),
		},
		{
			id: "group",
			label: "Lapor ke Grup Samudra",
			href: "https://chat.whatsapp.com/Fxg7ztLOfbJBcikGh4uPKD",
			bottom: "calc(136px + env(safe-area-inset-bottom))",
			bgColor: "#0A2540",
			icon: (
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
					<circle cx="9" cy="7" r="4" />
					<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
					<path d="M16 3.13a4 4 0 0 1 0 7.75" />
				</svg>
			),
		},
	];

	return (
		<>
			{buttons.map((btn) => (
				<div
					key={btn.id}
					className="fixed right-4 z-[60]"
					style={{ bottom: btn.bottom }}
				>
					{showTooltip === btn.id && (
						<div className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap bg-[#0A2540] text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-lg pointer-events-none">
							{btn.label}
							<div className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-2 bg-[#0A2540] rotate-45" />
						</div>
					)}
					<a
						href={btn.href}
						target="_blank"
						rel="noopener noreferrer"
						onPointerEnter={() => setShowTooltip(btn.id)}
						onPointerLeave={() => setShowTooltip(null)}
						onClick={() => setShowTooltip(null)}
						className="flex items-center justify-center w-14 h-14 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all"
						style={{ backgroundColor: btn.bgColor }}
						aria-label={btn.label}
					>
						{btn.icon}
					</a>
				</div>
			))}
		</>
	);
}
