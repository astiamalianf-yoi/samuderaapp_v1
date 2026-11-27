export const BEACHES = [
	{ id: "pantai_lampuuk", name: "Pantai Lampuuk", label: "Lampuuk" },
	{ id: "pantai_lhoknga", name: "Pantai Lhoknga", label: "Lhoknga" },
	{ id: "pantai_ulee_lheue", name: "Pantai Ulee Lheue", label: "Ulee Lheue" },
	{ id: "pantai_depok", name: "Pantai Depok", label: "Depok" },
	{ id: "pantai_samas", name: "Pantai Samas", label: "Samas" },
] as const;

export const LIK_SIGNS = [
	{ code: "WN-1", label: "Awan turun", icon: "cloud-lightning" },
	{ code: "WN-2", label: "Awan bergumpal", icon: "cloud" },
	{ code: "WN-3", label: "Kilat", icon: "zap" },
	{ code: "WN-4", label: "Ombak besar", icon: "waves" },
	{ code: "WN-5", label: "Lumba-lumba", icon: "fish" },
	{ code: "WN-6", label: "Burung camar", icon: "bird" },
	{ code: "WN-7", label: "Peralihan angin", icon: "wind" },
	{ code: "WN-8", label: "Langit merah", icon: "sunset" },
	{ code: "WN-9", label: "Bintang redup", icon: "star" },
	{ code: "WN-10", label: "Bulan sabit", icon: "moon" },
	{ code: "WN-11", label: "Pasang naik", icon: "arrow-up-circle" },
	{ code: "WN-12", label: "Arus deras", icon: "arrow-right" },
	{ code: "WN-13", label: "Ikan naik", icon: "fish" },
	{ code: "WN-14", label: "Udara panas", icon: "thermometer" },
	{ code: "WN-15", label: "Gempa kecil", icon: "activity" },
	{ code: "WN-16", label: "Bau lumpur", icon: "cloud-fog" },
	{ code: "WN-17", label: "Air laut keruh", icon: "droplets" },
	{ code: "WN-18", label: "Suara dentuman", icon: "volume-2" },
] as const;

export const WAVE_UNSAFE_THRESHOLD = 1.5;
export const WIND_UNSAFE_THRESHOLD = 30;

export const API_BASE = "/api";
