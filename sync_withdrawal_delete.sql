-- Fungsi untuk menghapus record di tiktok_withdrawals jika transaksi transfer (Pindah Buku) dihapus
CREATE OR REPLACE FUNCTION delete_tiktok_withdrawal_on_transfer_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Hanya hapus jika note-nya memuat kata 'Pencairan Dana TikTok'
    IF OLD.note LIKE 'Pencairan Dana TikTok - %' THEN
        DELETE FROM tiktok_withdrawals
        WHERE store = OLD.from_account
          AND target_bank = OLD.to_account
          AND amount = OLD.amount
          AND DATE(withdraw_date) = OLD.date;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Hapus trigger jika sudah ada sebelumnya agar tidak duplikat
DROP TRIGGER IF EXISTS trigger_delete_tiktok_withdrawal ON transfers;

-- Buat trigger pada tabel transfers saat operasi DELETE
CREATE TRIGGER trigger_delete_tiktok_withdrawal
AFTER DELETE ON transfers
FOR EACH ROW
EXECUTE FUNCTION delete_tiktok_withdrawal_on_transfer_delete();

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
