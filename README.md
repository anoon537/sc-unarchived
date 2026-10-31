# Socialchat Archive Manager

Website untuk memindai percakapan di menu Arsip berdasarkan tanggal pesan terakhir, lalu mengeluarkannya dari Arsip secara bertahap.

## Keamanan dan akses

- Halaman bisa dibuka publik. Operator login dengan email dan password akun Socialchat bersama. Password dikirim melalui HTTPS ke Vercel Function untuk autentikasi dan tidak disimpan aplikasi.
- Token sesi hasil login disimpan di `sessionStorage` tab agar sesi bertahan setelah refresh halaman. Password tidak disimpan. Logout atau menutup tab menghapus sesi; token tidak disimpan ke localStorage, cookie, database, atau file.
- Set `UNARCHIVE_SIGNING_SECRET` di Vercel (minimal 32 karakter acak) untuk menandatangani pratinjau. Nilai ini tidak dimasukkan operator ke halaman.
- Pratinjau hanya memuat ID dan tanggal pesan terakhir, bukan nama kontak atau isi percakapan. Setiap perubahan memerlukan konfirmasi jumlah persis.

## Menjalankan lokal

Node.js diperlukan; tidak ada paket tambahan yang perlu dipasang. Jalankan:

```powershell
node dev-server.js
```

Buka `http://127.0.0.1:4173`. Server membuat secret penandatangan lokal acak untuk sesi tersebut. Tidak ada API key tambahan yang perlu dimasukkan.

## Menggunakan website

1. Login dengan email dan password Socialchat.
2. Pilih tanggal awal dan akhir. Rentang inklusif dan memakai zona waktu Asia/Jakarta.
3. Tinjau pratinjau jumlah percakapan yang cocok.
4. Ketik konfirmasi jumlah yang ditampilkan.
5. Proses berjalan dalam batch kecil. Jika terhenti, buat pratinjau baru sebelum melanjutkan.

## Deploy ke Vercel

Hubungkan folder proyek ini sebagai proyek Vercel, set `UNARCHIVE_SIGNING_SECRET` pada environment Production (dan Preview jika diperlukan), lalu deploy. Jangan masukkan secret ke Git. Deploy belum dilakukan dari workspace ini karena belum ada proyek Vercel yang terhubung maupun autentikasi CLI.

Vercel membuat Functions dari file di folder `api/`; lihat [dokumentasi Vercel Functions](https://vercel.com/docs/functions) dan [konfigurasi `vercel.json`](https://vercel.com/docs/project-configuration/vercel-json).
