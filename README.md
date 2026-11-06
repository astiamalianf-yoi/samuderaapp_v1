# Peringatan Cuaca - Sistem Peringatan Dini Berbasis Pengetahuan Lokal

**Integrasi Layanan Peringatan Bencana Berbasis Pengetahuan Lokal bagi Nelayan Desa Pesisir**

Sistem peringatan dini cuaca untuk nelayan tradisional di Aceh dan Bantul, Yogyakarta. Menggabungkan pengetahuan lokal nelayan (tanda alam LIK) dengan model machine learning SHAP untuk menghasilkan peringatan cuaca yang akurat dan mudah dipahami.

## Tujuan

- Memberikan peringatan dini cuaca kepada nelayan tradisional yang memiliki literasi digital rendah
- Mengintegrasikan pengetahuan lokal (tanda-tanda alam) dengan data cuaca BMKG
- Menggunakan model SHAP untuk prediksi risiko berdasarkan karakteristik komunitas
- Menyebarkan peringatan melalui PWA, WhatsApp (OpenClaw), dan SSE real-time

## Arsitektur

```
PWA (Nelayan) --> POST /report --> Backend (Hono + Redis)
                                      |
                                      +--> SHAP ML API (prediksi risiko)
                                      +--> BMKG API (data cuaca)
                                      +--> OpenClaw (broadcast WhatsApp)
                                      +--> PWA (SSE real-time alerts)
                                      +--> ESP32 (MQTT via Mosquitto)
```

## Folder

| Folder | Deskripsi |
|--------|-----------|
| `frontend/` | PWA Next.js — antarmuka untuk nelayan (Beranda, Lapor, Peta, Pengetahuan) |
| `disaster-backend/` | Backend Hono + Bun — distribution hub, report processing, Redis |
| `SHAP-model-api/` | ML service Python — prediksi risiko berbasis SHAP + pengetahuan lokal |
| `docs/` | Dokumentasi desain sistem dan spesifikasi |
| `assets/` | Logo dan aset proyek |

## Repositori Terkait

- **SHAP Model API:** [github.com/itsqal/SHAP-model-api](https://github.com/itsqal/SHAP-model-api.git)
- **Disaster Backend:** [github.com/ScaferuZ/disaster-backend](https://github.com/ScaferuZ/disaster-backend.git)

## Target User

Komunitas nelayan di desa pesisir (Aceh dan Yogyakarta)

## Fitur Utama

- **Laporan Cuaca** — Nelayan melaporkan tanda alam (WN-1 sampai WN-13) melalui PWA
- **Threshold Per Pantai** — Pantai Safe (Lampuuk, Ulee Lheue) trigger di 3 laporan, Unsafe (Depok, Samas, Lhoknga) di 5
- **Peringatan Real-time** — SSE push ke PWA + broadcast WhatsApp via OpenClaw
- **Peta Pantai** — Status cuaca 5 pantai dengan data BMKG + marker lokasi user
- **Reassurance Loop** — Jika cuaca aman, sistem mengirim pesan tenang ke komunitas

---

## Quick Start (Docker Compose)

### Prasyarat

- [Docker](https://docs.docker.com/get-docker/) + Docker Compose
- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) (hanya untuk development lokal, tidak perlu jika hanya pakai Docker)

### 1. Clone & Setup Submodule

```bash
git clone https://github.com/astiamalianf-yoi/samuderaapp_v1.git
cd samuderaapp_v1
```

Jika sudah clone tanpa `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

### 2. Jalankan Semua Service

```bash
docker compose up -d --build
```

Ini akan menjalankan container utama berikut:

| Service | Container | Port | Deskripsi |
|---------|-----------|------|-----------|
| Redis | `thesis-redis` | `127.0.0.1:6379` | Queue, SSE, cooldown, active warnings |
| Mosquitto | `peringatan-mosquitto` | `1883` (local compose) | MQTT broker untuk ESP32/IoT |
| SHAP ML API | `thesis-ml` | internal only | Prediksi risiko berbasis SHAP |
| Backend | `thesis-backend` | `127.0.0.1:3000` | Hono API, report processing, SQLite DB |
| Frontend | `thesis-frontend` | `127.0.0.1:3001` | Next.js PWA |

### 3. Cek Status

```bash
docker compose ps
```

Pastikan semua container status `Running (healthy)`.

### 4. Aplikasi

Buka **http://localhost:3001** di browser.

### 5. Seed Data Pantai (Opsional)

```bash
docker compose exec backend bun scripts/seed-beaches.ts
```

### 6. Test Kirim Report

```bash
for i in $(seq 1 5); do
  curl -s -X POST http://localhost:3000/api/report \
    -H "Content-Type: application/json" \
    -d "{\"beach_location\":\"pantai_lampuuk\",\"lik_codes\":[\"Wn-1\"],\"createdAtClient\":$(date +%s%3N)}"
  echo
done
```

Setelah 5 report, alert akan muncul di homepage.

### 6.1 Test MQTT IoT dengan Mosquitto

Local compose membuka Mosquitto di port `1883`. Jalankan stack lokal:

```bash
docker compose -f docker-compose.local.yml up -d --build
```

Pantau pesan IoT:

```bash
docker compose -f docker-compose.local.yml exec mosquitto \
  mosquitto_sub -h localhost -t 'alert/#' -v
```

Kirim pesan test langsung ke ESP32:

```bash
docker compose -f docker-compose.local.yml exec mosquitto \
  mosquitto_pub -h localhost -t alert/pantai_lampuuk \
  -m '{"command":"ALARM_ON","riskLevel":"SIAGA","durationMs":15000}'
```

Backend hanya menerbitkan MQTT untuk `SIAGA` dan `EKSTREM`. Level `NORMAL` dan `WASPADA` tidak menyalakan buzzer.

Untuk ESP32, buka [`arduino/iot.ino`](arduino/iot.ino), install library Arduino `PubSubClient` dan `ArduinoJson`, lalu isi:

```cpp
const char *WIFI_SSID = "nama-wifi";
const char *WIFI_PASSWORD = "password-wifi";
const char *MQTT_HOST = "IP_LAPTOP_ATAU_VPS";
const char *MQTT_TOPIC = "alert/pantai_lampuuk";
```

Jika ESP32 berada di jaringan Wi-Fi yang sama dengan laptop, gunakan IP LAN laptop, bukan `localhost`.

### 7. Reset Data

```bash
# Flush Redis (hapus queue, warnings, cooldowns)
docker exec thesis-redis redis-cli FLUSHALL

# Hapus SQLite database (hapus semua data permanen)
docker compose down -v
```

---

## Environment Variables (Opsional)

Buat file `.env` di root project untuk konfigurasi tambahan:

```env
# URL backend yang bisa diakses dari internet (untuk OpenClaw webhook callback)
BASE_URL=https://your-domain.com

# OpenClaw WhatsApp Integration
OPENCLAW_GATEWAY_URL=https://your-openclaw-url
OPENCLAW_HOOK_TOKEN=your-hook-token
OPENCLAW_BROADCAST_GROUPS=group1,group2

# JWT Auth (default: false)
JWT_AUTH_ENABLED=false
JWT_SECRET=

# Web Push Notifications
VAPID_SUBJECT=mailto:you@example.com
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key

# IoT MQTT
ENABLE_IOT_MQTT_DELIVERY=true
MQTT_BROKER_URL=mqtt://mosquitto:1883
MQTT_TOPIC_PREFIX=alert
MQTT_QOS=1
MQTT_RETAIN=false
MQTT_ALARM_DURATION_MS=15000
```

---

## Development Lokal (Tanpa Docker)

### Backend

```bash
cd disaster-backend
bun install
bun run src/index.ts
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### ML API

```bash
cd SHAP-model-api
pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000
```

Pastikan Redis jalan di `localhost:6379`.

---

## Domain Produksi

Default: PWA di `https://www.samudraapp.com` (juga `samudraapp.com`), API di `https://api.samudraapp.com`.
Ganti lewat `.env` di server bila perlu:

```bash
APP_DOMAIN=www.samudraapp.com
APP_APEX_DOMAIN=samudraapp.com
API_DOMAIN=api.samudraapp.com
```

DNS: arahkan record A untuk `samudraapp.com`, `www` dan `api` ke IP server sebelum `docker compose up`, agar Let's Encrypt dapat menerbitkan sertifikat.

## Deployment ke VPS

### 1. Install Docker di VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. Clone & Jalankan

```bash
git clone https://github.com/astiamalianf-yoi/samuderaapp_v1.git
cd samuderaapp_v1
docker compose up -d --build
```

### 3. Reverse Proxy (Traefik/Nginx)

Contoh dengan Traefik — tambahkan labels ke `docker-compose.yml` pada service `frontend`:

```yaml
frontend:
  # ... existing config ...
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.frontend.rule=Host(`your-domain.com`)"
    - "traefik.http.routers.frontend.entrypoints=websecure"
    - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
    - "traefik.http.services.frontend.loadbalancer.server.port=3001"
```

Dan untuk backend API (jika perlu expose):

```yaml
backend:
  # ... existing config ...
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.backend.rule=Host(`api.your-domain.com`)"
    - "traefik.http.routers.backend.entrypoints=websecure"
    - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
    - "traefik.http.services.backend.loadbalancer.server.port=3000"
```

### 4. Update BASE_URL

Set `BASE_URL` di `.env` agar OpenClaw webhook bisa callback ke backend:

```env
BASE_URL=https://api.your-domain.com
```

Lalu restart: `docker compose up -d`

---

## Menjalankan Test

### Backend (Unit Test)

```bash
cd disaster-backend
bun test
```

### E2E Test (Playwright)

```bash
# Pastikan semua service jalan via Docker
docker compose up -d

# Jalankan E2E test
cd frontend
npx playwright install
npx playwright test
```
