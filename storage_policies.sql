-- Mengizinkan akses baca PUBLIK agar logo bisa ditampilkan di aplikasi
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'assets' );

-- Mengizinkan akses unggah (upload) bagi pengguna yang sudah login (Authenticated)
CREATE POLICY "Authenticated Upload" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK ( bucket_id = 'assets' );

-- Mengizinkan pengguna yang login meng-update logonya
CREATE POLICY "Authenticated Update" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING ( bucket_id = 'assets' );
