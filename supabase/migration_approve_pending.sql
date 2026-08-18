-- Migration: อัปเดต recipients ที่ถูกเพิ่มโดย admin แต่ status ยังเป็น 'pending'
-- ให้กลายเป็น 'approved' เพื่อให้สามารถตรวจสอบได้ผ่าน QR code
-- รัน SQL นี้ใน Supabase SQL Editor

UPDATE recipients
SET status = 'approved'
WHERE status = 'pending';

-- หมายเหตุ: หลังจากนี้ เมื่อ Admin เพิ่มรายชื่อผ่านระบบ
-- สถานะจะถูกตั้งเป็น 'approved' ทันที (ไม่ต้องรออนุมัติ)
