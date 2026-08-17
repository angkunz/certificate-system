-- ============================================================
-- ระบบออกเกียรติบัตรออนไลน์ — Database Schema
-- รัน SQL นี้ใน Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'executive')) NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: organization
-- ============================================================
CREATE TABLE IF NOT EXISTS organization (
  id INTEGER PRIMARY KEY DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'ชื่อองค์กรของคุณ',
  logo_url TEXT,
  executive_name TEXT NOT NULL DEFAULT 'ชื่อผู้บริหาร',
  executive_position TEXT NOT NULL DEFAULT 'ตำแหน่งผู้บริหาร',
  signature_url TEXT,
  theme_color TEXT DEFAULT '#1e3a8a',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: activities
-- ============================================================
CREATE TABLE IF NOT EXISTS activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  cert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  background_url TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Table: recipients
-- ============================================================
CREATE TABLE IF NOT EXISTS recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID REFERENCES activities(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  cert_code TEXT UNIQUE NOT NULL,
  extra_details TEXT,
  cert_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason TEXT,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Seed: Default Organization
-- ============================================================
INSERT INTO organization (id, name, executive_name, executive_position)
VALUES (1, 'ชื่อองค์กรของคุณ', 'ชื่อผู้บริหาร', 'ผู้อำนวยการ')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Seed: Default Users
-- NOTE: หลังรัน SQL นี้แล้ว ให้ไปที่ /api/setup เพื่อสร้าง
--       password hash อัตโนมัติ หรือใช้ API ของ Supabase
--       Admin default: admin / Admin@123
--       Executive default: executive / Exec@123
-- ============================================================

-- ============================================================
-- Storage: สร้าง bucket ใน Supabase Storage Dashboard
-- Bucket name: "certificates"  (Public)
-- Bucket name: "logos"         (Public)
-- Bucket name: "signatures"    (Public)
-- ============================================================

-- ============================================================
-- Sample Data (ลบได้ถ้าไม่ต้องการ)
-- ============================================================
-- (จะถูก insert ผ่าน /api/setup endpoint)
