-- ============================================================
-- Migration: เพิ่ม cert_layout column
-- รัน SQL นี้ใน Supabase SQL Editor (ถ้าสร้าง project ใหม่ ไม่ต้องรัน schema.sql เดิม)
-- ============================================================
ALTER TABLE organization ADD COLUMN IF NOT EXISTS cert_layout JSONB;

-- ============================================================
-- ตรวจสอบ: ดูว่าตารางมีครบไหม
-- ============================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'organization';
