# Analisis & Rekonsiliasi Aksi Rekomendasi Tanda Alam (Kode LIK)

Dokumen ini memuat daftar kemungkinan skenario (case) yang perlu dipertimbangkan untuk menetapkan **Aksi Rekomendasi** ketika terdapat lebih dari satu tanda alam (Multi-Kode LIK) yang teramati dalam waktu bersamaan. Dokumen ini juga memuat status integrasi data BMKG yang dapat diakses oleh sistem saat ini.

---

## 1. Data BMKG yang Dapat Diakses Saat Ini (Status Sistem SAMUDRA)

Berdasarkan *codebase* aplikasi SAMUDRA saat ini (`src/hooks/useWeatherAlerts.ts` dan `src/hooks/useWeatherForecast.ts`), sistem sudah dapat mengambil data berikut dari BMKG:

### A. Peringatan Dini Cuaca (Weather Alerts/Nowcast)
Diambil dari *RSS feed/CAP XML* BMKG:
*   **Lokasi** (Headline / Title)
*   **Waktu Efektif** (Start Time) & **Waktu Berakhir** (End Time)
*   **Kondisi Cuaca** (Event, e.g., "Peringatan Dini Cuaca")
*   **Deskripsi Prakiraan Cuaca** (Detail potensi hujan, angin, dll.)

### B. Prakiraan Cuaca Berdasarkan Wilayah (Weather Forecast - ADM4)
Diambil dari API Publik BMKG (`api.bmkg.go.id`):
*   **Suhu** (°C)
*   **Kelembaban** (%)
*   **Deskripsi Cuaca** (Cerah, Berawan, Hujan Ringan, dll.)
*   **Kecepatan Angin** (km/jam)
*   **Arah Angin**
*   **Jarak Pandang** (Visibility)

---

## 2. Kemungkinan Skenario (Case) Rekonsiliasi Multi-Tanda Alam

Mengingat satu laporan dapat memuat lebih dari 10 kode LIK sekaligus, berikut adalah kemungkinan skenario yang akan terjadi di lapangan yang perlu diputuskan *business logic*-nya:

### Skenario A: Kalkulasi Probabilitas Persentase Aksi
*Mengacu pada contoh dari Ibu Asti:*
*   **Kondisi:**
    *   Tanda 1 memicu: Aksi A (40%), Aksi B (60%)
    *   Tanda 2 memicu: Aksi A (40%), Aksi C (70%)
*   **Pertanyaan untuk Diputuskan:**
    *   Apakah sistem akan memunculkan **Aksi C** saja karena memiliki % individu tertinggi (70%)?
    *   Atau sistem akan menggabungkan probabilitas **Aksi A** (40% + 40% = akumulasi menjadi dominan) karena muncul di kedua tanda tersebut?

### Skenario B: Aksi yang Saling Bertentangan (Conflicting Actions)
*   **Kondisi:**
    *   Tanda alam 1 merekomendasikan: "Berlindung di dalam rumah" (Terkait angin kencang).
    *   Tanda alam 2 merekomendasikan: "Segera keluar rumah dan evakuasi ke tempat tinggi" (Terkait potensi gempa/tsunami).
*   **Pertanyaan untuk Diputuskan:**
    *   Bagaimana sistem menentukan prioritas? Apakah kita harus membuat hierarki/tingkatan (Level) bahaya untuk setiap aksi, di mana aksi "Evakuasi" selalu meng-*override* (menimpa) aksi lainnya?

### Skenario C: Penyesuaian Keputusan ML (Tanpa Intensitas)
*   **Kondisi (Terbaru):** Saat ini atribut "Intensitas" telah dihilangkan dari perhitungan Machine Learning (ML) dan sistem backend. Output ML hanya memprediksi status final berupa **Aman** atau **Tidak Aman** (`community_risk_behaviour: "Unsafe"`), disertai dengan **deskripsi (wording) dari ML** (contoh: *"Komunitas diklasifikasikan berisiko tinggi karena terdeteksi karakteristik..."*).
*   **Pertanyaan untuk Diputuskan:**
    *   Mengingat ML sudah mengeluarkan narasi deskripsi bahaya/risiko, apakah teks *Aksi Rekomendasi* untuk nelayan nantinya cukup mengambil/mengikuti teks deskripsi bawaan dari ML saja? Ataukah kita tetap butuh memetakan setiap kode LIK secara manual dengan *Aksi Spesifik* seperti di *Template Pemetaan Aksi* (Bagian 3) di bawah?

### Skenario D: Overlap/Redundansi Aksi dalam Laporan Besar
*   **Kondisi:** Terdapat 10 kode LIK yang terpenuhi dalam satu laporan. Dari pemetaan data, 8 di antaranya menghasilkan aksi dominan yang sama persis (misal: "Jauhi bibir pantai"). Sementara 2 kode LIK lainnya menghasilkan aksi yang sifatnya minor (misal: "Amankan barang berharga").
*   **Pertanyaan untuk Diputuskan:**
    *   Bagaimana cara kita membatasi output agar tidak membanjiri layar pengguna (UI/UX)? Apakah kita hanya menampilkan **Top 3 Aksi** yang paling banyak muncul/paling tinggi persentasenya?

### Skenario E: Benturan dengan Data Resmi (BMKG)
*   **Kondisi:** Tanda alam lokal yang diamati pengguna merekomendasikan status "Aman / Tetap Waspada". Namun, di titik waktu dan lokasi yang sama, data **Peringatan Dini Cuaca BMKG** yang ditarik oleh sistem menyatakan "Peringatan Badai Ekstrem".
*   **Pertanyaan untuk Diputuskan:**
    *   Apakah peringatan dari instansi resmi (BMKG) secara otomatis diposisikan sebagai rekomendasi final (meng-*override* data prediksi LIK lokal)? Ataukah keduanya disajikan secara berdampingan?

---

## 3. Template Pemetaan Aksi berdasarkan Kode LIK

Berikut adalah format/template kosong yang dapat digunakan Ibu Asti untuk memetakan persentase aksi dari keseluruhan kode LIK yang terdaftar:

*   wn-1 memicu: Aksi A (...%), Aksi B (...%)
*   wn-2 memicu: Aksi A (...%), Aksi B (...%)
*   wn-3 memicu: Aksi A (...%), Aksi B (...%)
*   wn-4 memicu: Aksi A (...%), Aksi B (...%)
*   wn-5 memicu: Aksi A (...%), Aksi B (...%)
*   wn-6 memicu: Aksi A (...%), Aksi B (...%)
*   wn-7 memicu: Aksi A (...%), Aksi B (...%)
*   wn-8 memicu: Aksi A (...%), Aksi B (...%)
*   wn-9 memicu: Aksi A (...%), Aksi B (...%)
*   wn-10 memicu: Aksi A (...%), Aksi B (...%)
*   wn-11 memicu: Aksi A (...%), Aksi B (...%)
*   wn-12 memicu: Aksi A (...%), Aksi B (...%)
*   wn-13 memicu: Aksi A (...%), Aksi B (...%)
*   wn-14 memicu: Aksi A (...%), Aksi B (...%)
*   wn-15 memicu: Aksi A (...%), Aksi B (...%)
*   wn-16 memicu: Aksi A (...%), Aksi B (...%)
*   wn-17 memicu: Aksi A (...%), Aksi B (...%)
*   wn-18 memicu: Aksi A (...%), Aksi B (...%)
*   ts-1 memicu: Aksi A (...%), Aksi B (...%)
*   ts-2 memicu: Aksi A (...%), Aksi B (...%)
*   ts-3 memicu: Aksi A (...%), Aksi B (...%)
*   ts-4 memicu: Aksi A (...%), Aksi B (...%)
*   ts-6 memicu: Aksi A (...%), Aksi B (...%)
*   cr-1 memicu: Aksi A (...%), Aksi B (...%)
*   cr-2 memicu: Aksi A (...%), Aksi B (...%)
*   cr-3 memicu: Aksi A (...%), Aksi B (...%)
*   cr-4 memicu: Aksi A (...%), Aksi B (...%)
*   td-1 memicu: Aksi A (...%), Aksi B (...%)
