Panduan Step-by-Step untuk Menjalankan API dan Testing Menggunakan curl
Berikut adalah panduan langkah-langkah untuk menjalankan API autentikasi dengan MFA (Multi-Factor Authentication) yang telah dibuat sebelumnya, serta melakukan pengujian menggunakan perintah curl. Panduan ini mencakup setup environment, menjalankan server, dan menguji endpoint registrasi, setup MFA, login, dan akses endpoint yang dilindungi. Saya akan memastikan instruksi sederhana dan mudah diikuti, dengan contoh curl untuk setiap langkah.
Prasyarat

    Perangkat:
        Komputer dengan Node.js terinstal (versi ≥18 direkomendasikan).
        MySQL server berjalan (misalnya, di localhost dengan port 3306).
        Aplikasi autentikator seperti Google Authenticator atau Microsoft Authenticator di ponsel Anda untuk MFA.
    Alat Pengujian:
        Terminal dengan curl terinstal (tersedia di Linux, macOS, atau Windows dengan Git Bash/PowerShell).
        Alternatif: Postman atau alat API client lainnya, tetapi panduan ini menggunakan curl.
    Dependensi Node.js:
        express, mysql2mysql2, bcrypt, express-rate-limit, jsonwebtoken, otplib, qrcode, dotenv.

Langkah-Langkah Setup dan Menjalankan API
Langkah 1: Setup Proyek

    Buat Direktori Proyek:
    bash

    mkdir auth-api
    cd auth-api
    npm init -y

    Install Dependensi:
    bash

    npm install express mysql2 bcrypt jsonwebtoken express-rate-limit otplib qrcode dotenv

    Buat File Kode:
        Simpan kode berikut sebagai index.js (salin dari kode sebelumnya yang sudah termasuk MFA):

    Buat File .env:
        Buat file .env di direktori proyek dengan isi berikut:

        DB_HOST=localhost
        DB_USER=root
        DB_PASSWORD=yourpassword
        DB_NAME=auth_db
        JWT_SECRET=yourverystrongsecret
        PORT=3000
        RATE_LIMIT_WINDOW=15
        RATE_LIMIT_MAX=100
        JWT_EXPIRATION_TIME=1h

        Ganti DB_PASSWORD dengan kata sandi MySQL Anda.
        Ganti DB_NAME dengan nama database yang Anda buat (misalnya, auth_db).
    Amankan File .env:
        Tambahkan .env ke .gitignore:
        bash

        echo ".env" >> .gitignore

        Atur izin file (di Linux/macOS):
        bash

        chmod 600 .env

Langkah 2: Setup Database MySQL

    Login ke MySQL:
    bash

    mysql -u root -p

    Masukkan kata sandi MySQL Anda.
    Buat Database:
    sql

    CREATE DATABASE auth_db;

    Keluar dari MySQL:
    sql

    EXIT;

Langkah 3: Jalankan Server

    Jalankan Aplikasi:
    bash

    node index.js

    Anda akan melihat pesan: Server running on port 3000.
    Verifikasi:
        Server berjalan di http://localhost:3000.
        Tabel users akan dibuat otomatis di database auth_db.

Langkah-Langkah Pengujian Menggunakan curl
Berikut adalah langkah-langkah untuk menguji API menggunakan curl. Setiap endpoint akan diuji secara berurutan, dan hasilnya akan dijelaskan.
1. Uji Endpoint Registrasi (/register)

    Tujuan: Mendaftarkan pengguna baru.
    Perintah curl:
    bash

    curl -X POST http://localhost:3000/register \
    -H "Content-Type: application/json" \
    -d '{"username":"user1","password":"password123"}'

    Respon yang Diharapkan:
    json

    {"message":"User registered"}

    Penjelasan:
        Pengguna user1 dibuat dengan kata sandi yang di-hash menggunakan bcrypt.
        Jika username sudah ada, Anda akan mendapatkan:
        json

        {"message":"Username already exists"}

2. Uji Endpoint Login Tanpa MFA (/login)

    Tujuan: Login untuk mendapatkan token JWT sebelum setup MFA.
    Perintah curl:
    bash

    curl -X POST http://localhost:3000/login \
    -H "Content-Type: application/json" \
    -d '{"username":"user1","password":"password123"}'

    Respon yang Diharapkan:
    json

    {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}

    Penjelasan:
        Karena MFA belum diatur, login hanya memerlukan username dan password.
        Simpan token JWT untuk langkah berikutnya (misalnya, dalam variabel TOKEN):
        bash

        TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

3. Uji Endpoint Setup MFA (/mfa/setup)

    Tujuan: Menghasilkan rahasia MFA dan QR code untuk aplikasi autentikator.
    Perintah curl:
    bash

    curl -X POST http://localhost:3000/mfa/setup \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN"

    Respon yang Diharapkan:
    json

    {
      "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...",
      "secret": "JBSWY3DPEHPK3PXP..."
    }

    Penjelasan:
        Endpoint ini memerlukan token JWT valid.
        qrCode adalah URL data gambar PNG yang dapat disimpan atau ditampilkan.
        secret adalah rahasia TOTP dalam format base32.
        Langkah Tambahan:
            Salin qrCode ke file gambar untuk memindai:
            bash

            echo "data:image/png;base64,iVBORw0KGgo..." | cut -d',' -f2 | base64 -d > qrcode.png

            Buka qrcode.png dan pindai menggunakan Google Authenticator atau aplikasi autentikator lainnya.
            Catat kode TOTP yang dihasilkan oleh aplikasi autentikator (berubah setiap 30 detik).

4. Uji Endpoint Login dengan MFA (/login)

    Tujuan: Login dengan username, password, dan kode TOTP setelah MFA diaktifkan.
    Perintah curl:
    bash

    curl -X POST http://localhost:3000/login \
    -H "Content-Type: application/json" \
    -d '{"username":"user1","password":"password123","totp":"123456"}'

    Ganti 123456 dengan kode TOTP dari aplikasi autentikator Anda.
    Respon yang Diharapkan:
    json

    {"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}

    Respon Gagal:
        Jika TOTP salah:
        json

        {"message":"Invalid TOTP"}

        Jika TOTP tidak diberikan:
        json

        {"message":"TOTP required"}

    Penjelasan:
        Setelah MFA diatur, login memerlukan kode TOTP yang valid.
        Simpan token baru untuk langkah berikutnya:
        bash

        TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

5. Uji Endpoint yang Dilindungi (/profile)

    Tujuan: Mengakses endpoint yang memerlukan autentikasi JWT.
    Perintah curl:
    bash

    curl -X GET http://localhost:3000/profile \
    -H "Authorization: Bearer $TOKEN"

    Respon yang Diharapkan:
    json

    {
      "message": "Welcome",
      "user": {
        "id": 1,
        "username": "user1",
        "iat": 1624267890,
        "exp": 1624271490
      }
    }

    Respon Gagal:
        Jika token tidak valid:
        json

        {"message":"Invalid token"}

        Jika token tidak diberikan:
        json

        {"message":"Token required"}

6. Uji Rate Limiting

    Tujuan: Memastikan rate limiting berfungsi (default: 100 permintaan per 15 menit).
    Perintah curl:
    Jalankan perintah berikut berulang kali (misalnya, 101 kali) dalam waktu singkat:
    bash

    for i in {1..101}; do curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d '{"username":"user1","password":"wrong"}'; done

    Respon yang Diharapkan:
        Setelah 100 permintaan, Anda akan melihat:
        json

        {"message":"Too many requests, please try again later."}

    Penjelasan:
        Rate limiting mencegah serangan brute force dengan membatasi jumlah permintaan.

Catatan Tambahan

    Waktu Kadaluarsa Token: Dikonfigurasi melalui JWT_EXPIRATION_TIME=1h di .env. Jika token kadaluarsa, login ulang untuk mendapatkan token baru.
    Keamanan:
        Pastikan menggunakan HTTPS di produksi.
        Jangan bagikan JWT_SECRET atau rahasia MFA.
        Untuk pemulihan MFA, pertimbangkan menambahkan kode cadangan (di luar cakupan kode ini).
    Debugging:
        Jika mendapatkan error database, periksa kredensial di .env dan pastikan MySQL berjalan.
        Jika QR code tidak valid, pastikan aplikasi autentikator mendukung TOTP.
    Alternatif Pengujian:
        Gunakan Postman untuk antarmuka grafis.
        Untuk melihat QR code, salin qrCode ke browser atau simpan sebagai file gambar.

Kesimpulan
Panduan ini mencakup setup proyek, konfigurasi database, menjalankan server, dan pengujian semua endpoint menggunakan curl. Dengan mengikuti langkah-langkah di atas, Anda dapat menjalankan API autentikasi dengan MFA dan memverifikasi fungsinya. Jika ada masalah atau perlu fitur tambahan, beri tahu saya!