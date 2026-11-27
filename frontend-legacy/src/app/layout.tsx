import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { BottomNav } from "@/components/bottom-nav";
import { WhatsAppFloatButton } from "@/components/whatsapp-float";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import "./globals.css";

const outfit = localFont({
	src: [
		{ path: "../fonts/Outfit-400.ttf", weight: "400", style: "normal" },
		{ path: "../fonts/Outfit-600.ttf", weight: "600", style: "normal" },
		{ path: "../fonts/Outfit-700.ttf", weight: "700", style: "normal" },
	],
	variable: "--font-heading",
	display: "swap",
});

const jakarta = localFont({
	src: [
		{ path: "../fonts/JakartaSans-400.ttf", weight: "400", style: "normal" },
		{ path: "../fonts/JakartaSans-500.ttf", weight: "500", style: "normal" },
		{ path: "../fonts/JakartaSans-600.ttf", weight: "600", style: "normal" },
	],
	variable: "--font-sans",
	display: "swap",
});

export const metadata: Metadata = {
	title: "CuacaPesisir",
	description: "Sistem peringatan cuaca pesisir untuk nelayan",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "CuacaPesisir",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	themeColor: "#0A2540",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="id" className={`${outfit.variable} ${jakarta.variable} h-full antialiased`}>
			<body className="min-h-full flex flex-col bg-background text-foreground">
				{children}
			<WhatsAppFloatButton />
			<BottomNav />
			<Toaster position="top-center" />
			<ServiceWorkerRegistrar />
			</body>
		</html>
	);
}
