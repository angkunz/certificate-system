-- Migration: เพิ่มฟิลด์ award (รางวัล/ผลงาน) ในตาราง recipients
-- รัน SQL นี้ใน Supabase SQL Editor

ALTER TABLE recipients ADD COLUMN IF NOT EXISTS award TEXT;

-- คอมเม้นต์: ฟิลด์นี้เก็บข้อมูลรางวัล/ผลงานของผู้รับเกียรติบัตร
-- เช่น "รางวัลชนะเลิศ", "ดีเด่น", "เหรียญทอง", etc.
COMMENT ON COLUMN recipients.award IS 'รางวัล/ผลงาน ของผู้รับเกียรติบัตร';
