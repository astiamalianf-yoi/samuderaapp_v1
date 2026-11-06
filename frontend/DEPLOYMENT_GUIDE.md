# Panduan Deployment SAMUDRA (VPS + Traefik + CI/CD)

Dokumen ini berisi langkah-langkah detail untuk mengaktifkan otomatisasi *deployment* (CI/CD) ke server VPS Anda (`43.156.242.107`) menggunakan GitHub Actions dan Traefik.

---

## Tahap 1: Verifikasi Server & Traefik (Bersama Teman Anda)

Sebelum GitHub Actions dapat mengirim aplikasi ke server, Anda dan teman Anda perlu memastikan beberapa hal di VPS:

1.  **Cari Nama Network Traefik:**
    - Teman Anda perlu masuk (SSH) ke VPS dan menjalankan perintah ini:
      ```bash
      docker network ls
      ```
    - Cari *network* yang terhubung dengan Traefik (biasanya bernama `proxy`, `traefik_webgateway`, `web`, dsb).
    - **PENTING**: Jika namanya BUKAN `proxy`, buka file `docker-compose.yml` di proyek Anda, lalu ubah kata `proxy` di bagian bawah (`networks`) dan di bagian `labels` menjadi nama network yang benar.

2.  **Cari Nama Certificate Resolver (Untuk HTTPS/SSL):**
    - Tanyakan kepada teman Anda apa nama `certresolver` yang dikonfigurasi di Traefik untuk SSL/Let's Encrypt (biasanya dinamakan `myresolver`, `letsencrypt`, atau `le`).
    - Buka `docker-compose.yml`, cari baris ini:
      `- "traefik.http.routers.samudra-frontend.tls.certresolver=myresolver"`
    - Ganti `myresolver` dengan nama resolver dari teman Anda. Jika belum pakai HTTPS, hapus saja baris ini dan baris `websecure`.

---

## Tahap 2: Pengaturan Domain (DNS)

1. Masuk ke panel manajemen domain Anda (misal: Cloudflare, Niagahoster, RumahWeb).
2. Cari menu **DNS Management**.
3. Tambahkan 2 buah **A Record**:
   - Name: `@` (atau kosong) -> IP: `43.156.242.107`
   - Name: `www` -> IP: `43.156.242.107`
4. Tunggu beberapa saat agar propagasi DNS selesai.

---

## Tahap 3: Persiapan SSH Key (Kunci Masuk Server)

GitHub Actions membutuhkan "Kunci" agar bisa otomatis masuk ke VPS Anda dan me-_restart_ Docker.

1. **Buat Kunci SSH di VPS (Jika Belum Ada)**
   Buka terminal/Command Prompt, jalankan (atau minta teman Anda):
   ```bash
   ssh-keygen -t ed25519 -C "github-actions"
   ```
   *(Tekan Enter terus sampai selesai, jangan beri password)*

2. **Daftarkan Kunci Publik ke Server**
   ```bash
   cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
   ```

3. **Ambil Kunci Privat**
   ```bash
   cat ~/.ssh/id_ed25519
   ```
   > ⚠️ **Simpan output ini (dari tulisan `BEGIN PRIVATE KEY` sampai `END PRIVATE KEY`). Anda akan memasukkannya ke GitHub.**

---

## Tahap 4: Pengaturan GitHub Secrets

Kita perlu memasukkan data server ke GitHub secara rahasia.

1. Buka Repositori SAMUDRA Anda di web GitHub.
2. Buka menu **Settings** (Pengaturan).
3. Di panel kiri, cari **Secrets and variables**, lalu klik **Actions**.
4. Klik tombol hijau **New repository secret**.
5. Tambahkan 3 variabel rahasia ini satu per satu:
   
   - **Secret 1**
     - Name: `SSH_HOST`
     - Secret: `43.156.242.107`
   
   - **Secret 2**
     - Name: `SSH_USERNAME`
     - Secret: `root` *(Ganti dengan username VPS Anda, misal: ubuntu/debian/aditya)*
   
   - **Secret 3**
     - Name: `SSH_KEY`
     - Secret: *(Paste seluruh teks Kunci Privat dari Tahap 3 Langkah 3 di sini)*

---

## Tahap 5: Aktifkan Akses GitHub Packages

Karena _workflow_ kita menyimpan Docker image di **ghcr.io** (GitHub Container Registry):
1. Buka web GitHub, klik foto profil Anda di pojok kanan atas, pilih **Settings**.
2. Gulir ke bawah di panel kiri, pilih **Developer settings**, lalu **Personal access tokens** -> **Tokens (classic)**.
3. Buat token baru (`Generate new token`). Centang perizinan: `write:packages` dan `delete:packages`.
4. Copy token tersebut.
5. Kembali ke **Settings -> Secrets and variables -> Actions** di Repositori SAMUDRA.
6. Buat _secret_ baru bernama `CR_PAT` (Container Registry Personal Access Token) dan *paste* token tadi.
   *(Catatan: Langkah ini terkadang opsional jika `GITHUB_TOKEN` bawaan repo sudah otomatis diberi izin baca/tulis oleh sistem GitHub. Namun membuat PAT jauh lebih dijamin keberhasilannya).*

---

## Tahap 6: Saatnya Deploy!

1. Buka VS Code Anda.
2. Jalankan perintah ini di terminal:
   ```bash
   git add .
   git commit -m "feat: setup CI/CD docker traefik deployment"
   git push
   ```
3. Langsung buka tab **"Actions"** di repositori GitHub Anda.
4. Anda akan melihat sebuah proses bernama **"Deploy PWA to VPS"** sedang berputar (berjalan kuning).
5. Jika warnanya berubah menjadi **Centang Hijau**, selamat! Aplikasi sudah berhasil di-*deploy* ke VPS secara otomatis.
6. Coba buka `https://samudraapp.com` di browser.

> [!TIP]
> Jika terjadi _Error/Silang Merah_ pada proses GitHub Actions, klik *error* tersebut, baca log merahnya, dan konsultasikan (copy-paste) pesan error tersebut ke saya untuk dicari solusinya.
