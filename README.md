# 🚀 MEDIAFAIRY GATEWAY CORE

Sebuah *backend tunneling* berbasis WebSocket yang sangat ringan, dioptimalkan khusus untuk VLESS dan Trojan. Dirancang untuk berjalan mulus di *platform serverless* atau PaaS (seperti Railway) tanpa memerlukan hak akses *root* atau *kernel-level networking*.

---

## ✨ Fitur Utama

* **Pure Node.js:** Tanpa perlu instalasi *core* eksternal (seperti Xray/v2ray) atau dependensi tingkat OS.
* **Protokol Ganda:** Mendukung *inbound* VLESS dan Trojan secara bersamaan dalam satu *port*.
* **Direct Routing:** Meneruskan trafik TCP dan UDP secara langsung (Native `dgram`) ke internet.
* **Premium Dashboard:** Dilengkapi UI berdesain Vercel x macOS Premium untuk memantau status *Uptime* dan kalkulasi *Bandwidth* (TX/RX) secara *real-time*.
* **Quick Generator:** Fitur *1-click generate* & *copy* untuk merakit URI VLESS dan Trojan secara otomatis dari halaman dasbor utama.
* **Auto-Port Binding:** Otomatis mendeteksi dan menyesuaikan *port* internal yang diberikan oleh sistem *cloud*.

---

## 🌍 PRA-DEPLOYMENT: Mengubah Region ke Singapura (PENTING)

Agar koneksi VPN Anda memiliki latensi (*ping*) yang rendah dan stabil, sangat disarankan untuk mengubah lokasi *server* Railway ke Singapura sebelum melakukan *deploy*.

1. Masuk ke *dashboard* [Railway](https://railway.app/).
2. Buat proyek baru dengan mengklik **New Project** -> **Empty Project**.
3. Di dalam proyek tersebut, klik tombol **Settings** (ikon roda gigi) di pojok kanan atas, atau masuk ke menu **Settings** -> tab **Environments**.
4. Cari opsi **Region** dan ubah lokasinya dari lokasi *default* (biasanya *US West*) menjadi **Singapore (Asia)**.
5. Setelah region tersimpan, kembali ke tampilan kanvas proyek Anda untuk memulai *deployment*.

---

## ⚙️ Panduan Deployment (Railway)

Setelah wilayah *server* dipastikan berada di Singapura, ikuti langkah berikut:

1. **Fork atau Upload** repositori ini (berisi `server.js` dan `package.json`) ke akun GitHub Anda.
2. Pada kanvas proyek Railway yang sudah diatur regionnya tadi, klik **New** -> **GitHub Repo**.
3. Pilih repositori MEDIAFAIRY yang baru saja Anda buat.
4. Railway akan otomatis mendeteksi lingkungan Node.js, menginstal dependensi (`ws`), dan menjalankan server.
5. Setelah status *deploy* menjadi hijau (Success), masuk ke pengaturan *service* tersebut, buka tab **Networking**, lalu klik **Generate Domain**.
6. Buka *domain publik* tersebut di *browser* Anda. Jika Anda melihat dasbor **MEDIAFAIRY** dengan status *Running*, server siap digunakan!

---

## 📱 Konfigurasi Klien VPN

Anda memiliki dua opsi untuk memasukkan konfigurasi ke dalam aplikasi VPN klien (Nekobox, v2rayNG, NapsternetV, dll):

### Opsi 1: Otomatis via Quick Generator (Direkomendasikan)
1. Buka halaman web domain Railway Anda.
2. Pada bagian bawah dasbor, klik tombol **Generate VLESS** atau **Generate TROJAN**.
3. *Script* akan otomatis membuatkan konfigurasi dengan UUID acak yang valid.
4. Klik tombol **Copy** dan *Import from Clipboard* di aplikasi VPN Anda.

### Opsi 2: Konfigurasi Manual
Jika ingin memasukkannya secara manual, pastikan Anda menggunakan **Port 443** dan mengaktifkan **TLS**.

**Format VLESS (WSS):**
* **Address / Server:** `[domain-railway-anda].up.railway.app`
* **Port:** `443`
* **UUID:** `[isi-dengan-uuid-v4-bebas]`
* **Network / Transport:** `ws` (WebSocket)
* **Path:** `/vless-mediafairy`
* **TLS / Security:** `tls`
* **SNI / Server Name:** `[domain-railway-anda].up.railway.app`
* **ALPN:** Kosongkan atau pilih `http/1.1`

**Format Trojan (WSS):**
* **Address / Server:** `[domain-railway-anda].up.railway.app`
* **Port:** `443`
* **Password:** `[isi-password-bebas]`
* **Network / Transport:** `ws` (WebSocket)
* **Path:** `/trojan-mediafairy`
* **TLS / Security:** `tls`
* **SNI / Server Name:** `[domain-railway-anda].up.railway.app`

---

## ⚠️ Catatan Penting

* **Data Dasbor Volatil:** Fitur pelacak *bandwidth* (TX/RX) berjalan secara *in-memory*. Artinya, jika kontainer Railway mengalami *restart* (karena *deploy* ulang atau pemeliharaan *server* internal mereka), hitungan data akan kembali ke `0 B`.
* **Limitasi UDP WebRTC:** Sistem ini menggunakan *UDP over TCP* secara *native* di Node.js. Fitur ini mumpuni untuk *gaming* atau tes DNS, namun mungkin akan mengalami kendala atau *timeout* jika digunakan untuk panggilan *Video/Voice* berbasis WebRTC (seperti WhatsApp Call) karena keterbatasan NAT platform *cloud*. Wajib hidupkan **TUN Mode** di aplikasi VPN Anda agar UDP tertangkap secara maksimal.
* **Rotasi IP:** Egress IP (IP Publik yang terbaca di internet) akan otomatis mengikuti IP *pool* dinamis milik Railway atau mitra GCP mereka, dan dapat berubah-ubah seiring waktu.

---
*Premium tunneling backend developed for high-performance routing.*
