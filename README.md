# 🚀 MEDIAFAIRY GATEWAY CORE

Sebuah *backend tunneling* berbasis WebSocket yang sangat ringan, dioptimalkan khusus untuk VLESS dan Trojan. Dirancang untuk berjalan mulus di *platform serverless* atau PaaS (seperti Railway) tanpa memerlukan hak akses *root* atau *kernel-level networking*.

---

## ✨ Fitur Utama

* **Pure Node.js:** Tanpa perlu instalasi *core* eksternal (seperti Xray/v2ray) atau dependensi sistem operasi.
* **Protokol Ganda:** Mendukung *inbound* VLESS dan Trojan dalam satu *port* secara bersamaan.
* **Direct Routing:** Meneruskan trafik TCP dan UDP (Native Node.js `dgram`) langsung ke internet tanpa perantara *proxy* pihak ketiga.
* **Live Dashboard:** Dilengkapi UI untuk memantau status *Uptime*, serta kalkulasi *Bandwidth* (TX/RX) secara *real-time* di halaman utama.
* **Auto-Port Binding:** Otomatis mendeteksi dan menyesuaikan *port* internal yang diberikan oleh sistem *cloud*.

---

## ⚙️ Panduan Deployment (Railway)

*Script* ini dibuat khusus agar bisa langsung berjalan (Plug & Play) di Railway.

1. **Fork atau Upload** repositori ini (berisi `server.js` dan `package.json`) ke akun GitHub Anda.
2. Buka *dashboard* [Railway](https://railway.app/).
3. Klik **New Project** -> **Deploy from GitHub repo**.
4. Pilih repositori yang baru saja Anda buat.
5. Railway akan otomatis mendeteksi lingkungan Node.js, menginstal dependensi (`ws`), dan menjalankan server.
6. Tunggu hingga status *deploy* menjadi hijau (Success).
7. Buka *domain publik* yang diberikan oleh Railway (contoh: `namaproject.up.railway.app`). Jika Anda melihat dasbor **MEDIAFAIRY** dengan status *Running*, server siap digunakan!

---

## 📱 Konfigurasi Klien VPN

Karena *script* ini berjalan di belakang *Reverse Proxy* Railway, Anda **wajib menggunakan Port 443 dan mengaktifkan TLS** pada aplikasi klien (Nekobox, v2rayNG, NapsternetV, dll).

### 1. Format VLESS (WSS)
Gunakan format di bawah ini untuk menghubungkan klien VLESS:

* **Address / Server:** `[domain-railway-anda].up.railway.app`
* **Port:** `443`
* **UUID:** `[isi-dengan-uuid-v4-bebas]` *(Script ini mendukung passwordless/UUID bebas)*
* **Network / Transport:** `ws` (WebSocket)
* **Path:** `/vless-mediafairy`
* **TLS / Security:** `tls`
* **SNI / Server Name:** `[domain-railway-anda].up.railway.app`
* **ALPN:** Kosongkan atau pilih `http/1.1`

**Contoh URI VLESS:**
```text
vless://b831381d-6324-4d53-ad4f-8cda48b30811@domain-anda.up.railway.app:443?encryption=none&security=tls&sni=domain-anda.up.railway.app&type=ws&host=domain-anda.up.railway.app&path=%2Fvless-mediafairy#Mediafairy-VLESS
