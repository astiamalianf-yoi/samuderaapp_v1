"use client";

import { Info } from "lucide-react";

export function ExplanationInfo() {
	return (
		<div className="rounded-lg border border-blue-100 bg-blue-50/40 p-3 mt-1">
			<div className="flex items-start gap-2">
				<Info size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
				<div className="space-y-2 text-[10px] text-muted-foreground leading-relaxed">
					<p>
						<strong className="text-[#0A2540]">Tentang Nilai Profil Komunitas</strong>
					</p>
					<p>
						Nilai pada tabel di atas berasal dari <em>survei komunitas nelayan</em> yang mengukur
						karakteristik masing-masing pantai terhadap 5 faktor: tingkat interaksi dengan bencana,
						frekuensi penggunaan sistem, durasi penggunaan, jumlah kombinasi tanda alam (LIK) yang
						dikenali, dan pengalaman bencana.
					</p>
					<p>
						<strong className="text-[#0A2540]">Status Aman/Rentan</strong> ditentukan berdasarkan
						ambang batas (threshold) dari aturan komunitas setempat. Faktor berstatus &quot;Rentan&quot;
						memberikan kontribusi positif terhadap skor risiko.
					</p>
					<p>
						<strong className="text-[#0A2540]">Grafik Kontribusi Risiko</strong> menggunakan pendekatan
						SHAP (SHapley Additive exPlanations). Bobot setiap tanda alam ditentukan oleh tingkat
						eskalasi tindakan nelayan: <em>Berhati-hati</em> (30%), <em>Siaga Penuh</em> (60%), dan
						<em> Sesuaikan Jadwal</em> (90%). Bobot komunitas sebesar 50% diberikan pada setiap faktor
						yang berstatus Rentan. Semua bobot kemudian dinormalisasi agar totalnya 100%.
					</p>
					<p>
						<strong className="text-[#0A2540]">Validasi Silang</strong> membandingkan hasil analisis SHAP
						dengan data cuaca terkini dari BMKG. Jika keduanya konsisten, tingkat kepercayaan
						peringatan lebih tinggi.
					</p>
				</div>
			</div>
		</div>
	);
}
